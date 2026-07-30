import {
  annualReturns,
  annualizedStdev,
  bestWorstFullYears,
  cagr,
  coveredYears,
  cumulativeInflation,
  endBalance,
  maxDrawdown,
  realAnnualReturns,
  realCagr,
  realEndBalance,
  sharpe,
  sortino,
  type InflationRate,
} from "@/engine"
import type { MonthlyReturn } from "@/types/series"

/** ชนิดของค่าในตาราง ใช้เลือกวิธีจัดรูปแบบที่หน้าจอ */
export type MetricFormat = "money" | "percent" | "ratio"

/** ทิศทางที่ถือว่า "ดีกว่า" — ความผันผวนและช่วงขาดทุนยิ่งใกล้ศูนย์ยิ่งดี */
type Direction = "higher-better" | "closer-to-zero-better"

export type SummaryRow = {
  /** คีย์ของคำอธิบายใน metric-glossary */
  metric: string
  format: MetricFormat
  portfolio: number | null
  benchmark: number | null
  /** ปีของค่านั้น สำหรับแถวปีที่ดีที่สุด/แย่ที่สุด */
  portfolioYear?: number
  benchmarkYear?: number
  /** พอร์ตดีกว่าหรือแย่กว่าตัวเทียบ — null เมื่อเทียบไม่ได้ */
  comparison: "better" | "worse" | "equal" | null
  /** เหตุผลที่ค่านี้คำนวณไม่ได้ (คีย์ i18n) */
  unavailableReason?: string
  /** ค่านี้หักเงินเฟ้อแล้ว — หน้าจอต้องกำกับให้เห็น ไม่ใช่เปลี่ยนตัวเลขเงียบ ๆ (BR-INF-10) */
  adjusted?: boolean
}

/** ดัชนีเงินเฟ้อไทยและสถานะของตัวเลือกปรับเงินเฟ้อ (US-15) */
export type InflationInput = {
  rates: InflationRate[]
  enabled: boolean
}

export type Summary = {
  rows: SummaryRow[]
  months: number
  /** ปีที่ยังไม่มีดัชนีเงินเฟ้อประกาศ — ว่างเสมอเมื่อไม่ได้เปิดตัวเลือก (BR-INF-09) */
  inflationGapYears: number[]
}

const DIRECTION: Record<string, Direction> = {
  endBalance: "higher-better",
  cagr: "higher-better",
  stdev: "closer-to-zero-better",
  bestYear: "higher-better",
  worstYear: "higher-better",
  maxDrawdown: "closer-to-zero-better",
  sharpe: "higher-better",
  sortino: "higher-better",
}

/**
 * ประกอบตารางสรุปจากผลตอบแทนรายเดือน (BR-SUM-02, BR-SUM-03)
 *
 * ทุกค่ามาจากชั้นคำนวณ ฟังก์ชันนี้ทำได้แค่จัดเรียงและเทียบทิศ — ไม่มีการคำนวณใหม่
 * ผลตอบแทนของตัวเทียบต้องถูกตัดให้เป็นช่วงเดียวกับพอร์ตมาแล้ว มิฉะนั้นจะเป็นการเทียบคนละช่วง
 */
export function assembleSummary(input: {
  portfolio: MonthlyReturn[]
  benchmark: MonthlyReturn[]
  riskFree: MonthlyReturn[]
  amount: number
  inflation?: InflationInput
}): Summary {
  const { portfolio, benchmark, riskFree, amount, inflation } = input
  const adjusting = inflation?.enabled === true
  const rates = inflation?.rates ?? []

  /**
   * ค่าที่หักเงินเฟ้อได้ของหนึ่งชุดผลตอบแทน (BR-INF-04)
   * ตัวคูณสะสมคิดจากปีที่ชุดนั้นแตะเอง เพราะพอร์ตกับตัวเทียบอาจมีเดือนไม่เท่ากัน
   */
  const deflate = (series: MonthlyReturn[]) => {
    const nominalEnd = endBalance(series, amount)
    if (!adjusting) {
      return { endBalance: nominalEnd, cagr: cagr(series), missingYears: [] as number[] }
    }
    const { factor, missingYears } = cumulativeInflation(coveredYears(series), rates)
    const realEnd = realEndBalance(nominalEnd, factor)
    return { endBalance: realEnd, cagr: realCagr(realEnd, amount, series.length), missingYears }
  }

  const yearly = (series: MonthlyReturn[]) => {
    const annual = annualReturns(series)
    return bestWorstFullYears(adjusting ? realAnnualReturns(annual, rates) : annual)
  }

  const portfolioTotals = deflate(portfolio)
  const benchmarkTotals = deflate(benchmark)
  const portfolioAnnual = yearly(portfolio)
  const benchmarkAnnual = yearly(benchmark)
  const portfolioDrawdown = maxDrawdown(portfolio)
  const benchmarkDrawdown = maxDrawdown(benchmark)
  const portfolioSortino = sortino(portfolio, riskFree)
  const benchmarkSortino = sortino(benchmark, riskFree)

  // ค่าความเสี่ยงทุกตัวยังเป็นตัวเงินปกติ เพราะนิยามบนผลตอบแทนรายเดือน
  // ซึ่งดัชนีเงินเฟ้อรายปีไม่มีความละเอียดพอจะปรับได้ (BR-INF-08)
  const rows: SummaryRow[] = [
    row("startAmount", "money", amount, amount),
    adjusted(row("endBalance", "money", portfolioTotals.endBalance, benchmarkTotals.endBalance)),
    adjusted(row("cagr", "percent", portfolioTotals.cagr, benchmarkTotals.cagr)),
    row("stdev", "percent", annualizedStdev(portfolio), annualizedStdev(benchmark)),
    adjusted({
      ...row("bestYear", "percent", portfolioAnnual.best?.value ?? null, benchmarkAnnual.best?.value ?? null),
      portfolioYear: portfolioAnnual.best?.year,
      benchmarkYear: benchmarkAnnual.best?.year,
    }),
    adjusted({
      ...row("worstYear", "percent", portfolioAnnual.worst?.value ?? null, benchmarkAnnual.worst?.value ?? null),
      portfolioYear: portfolioAnnual.worst?.year,
      benchmarkYear: benchmarkAnnual.worst?.year,
    }),
    row("maxDrawdown", "percent", portfolioDrawdown?.depth ?? null, benchmarkDrawdown?.depth ?? null),
    row("sharpe", "ratio", sharpe(portfolio, riskFree), sharpe(benchmark, riskFree)),
    {
      ...row("sortino", "ratio", portfolioSortino, benchmarkSortino),
      unavailableReason: portfolioSortino === null ? "summary.noDownside" : undefined,
    },
  ]

  const inflationGapYears = [
    ...new Set([...portfolioTotals.missingYears, ...benchmarkTotals.missingYears]),
  ].sort((a, b) => a - b)

  return { rows, months: portfolio.length, inflationGapYears }

  function adjusted(target: SummaryRow): SummaryRow {
    return adjusting ? { ...target, adjusted: true } : target
  }
}

function row(
  metric: string,
  format: MetricFormat,
  portfolio: number | null,
  benchmark: number | null,
): SummaryRow {
  return { metric, format, portfolio, benchmark, comparison: compare(metric, portfolio, benchmark) }
}

function compare(
  metric: string,
  portfolio: number | null,
  benchmark: number | null,
): SummaryRow["comparison"] {
  if (portfolio === null || benchmark === null) return null
  // เงินตั้งต้นเท่ากันเสมอ ไม่ต้องเทียบ
  if (metric === "startAmount") return null

  const direction = DIRECTION[metric] ?? "higher-better"
  const [a, b] =
    direction === "closer-to-zero-better"
      ? [Math.abs(portfolio), Math.abs(benchmark)]
      : [portfolio, benchmark]

  // ต่างกันน้อยกว่าที่ปัดแล้วจะเห็น ถือว่าเท่ากัน
  if (Math.abs(a - b) < 1e-9) return "equal"
  if (direction === "closer-to-zero-better") return a < b ? "better" : "worse"
  return a > b ? "better" : "worse"
}
