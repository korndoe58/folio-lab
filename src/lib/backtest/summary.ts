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

/** ค่าของหนึ่งพอร์ตในหนึ่งแถว */
export type SummaryCell = {
  value: number | null
  /** ปีของค่านั้น สำหรับแถวปีที่ดีที่สุด/แย่ที่สุด */
  year?: number
  /**
   * พอร์ตนี้ดีกว่าหรือแย่กว่า **ตัวเทียบ** — null เมื่อเทียบไม่ได้
   * เทียบกับตัวเทียบเสมอ ไม่ใช่เทียบพอร์ตกันเอง เพราะพอร์ตไหน "ดีกว่า" ขึ้นกับว่าผู้ใช้
   * ให้น้ำหนักผลตอบแทนหรือความเสี่ยง ซึ่งเครื่องมือไม่ควรตัดสินแทน (BR-CMP-23)
   */
  comparison: "better" | "worse" | "equal" | null
  /** เหตุผลที่ค่านี้คำนวณไม่ได้ (คีย์ i18n) */
  unavailableReason?: string
}

export type SummaryRow = {
  /** คีย์ของคำอธิบายใน metric-glossary */
  metric: string
  format: MetricFormat
  /** หนึ่งช่องต่อพอร์ต เรียงตามลำดับพอร์ตในฟอร์ม (BR-CMP-22, BR-CMP-26) */
  portfolios: SummaryCell[]
  benchmark: number | null
  benchmarkYear?: number
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
  /** ผลตอบแทนของแต่ละพอร์ต ตัดให้เป็นช่วงเวลาร่วมเดียวกันมาแล้ว (BR-CMP-04) */
  portfolios: MonthlyReturn[][]
  benchmark: MonthlyReturn[]
  riskFree: MonthlyReturn[]
  amount: number
  inflation?: InflationInput
}): Summary {
  const { portfolios, benchmark, riskFree, amount, inflation } = input
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

  const totals = portfolios.map(deflate)
  const annual = portfolios.map(yearly)
  const drawdowns = portfolios.map(maxDrawdown)
  const sortinos = portfolios.map((series) => sortino(series, riskFree))

  const benchmarkTotals = deflate(benchmark)
  const benchmarkAnnual = yearly(benchmark)
  const benchmarkDrawdown = maxDrawdown(benchmark)

  // ค่าความเสี่ยงทุกตัวยังเป็นตัวเงินปกติ เพราะนิยามบนผลตอบแทนรายเดือน
  // ซึ่งดัชนีเงินเฟ้อรายปีไม่มีความละเอียดพอจะปรับได้ (BR-INF-08)
  const rows: SummaryRow[] = [
    row("startAmount", "money", portfolios.map(() => ({ value: amount })), amount),
    adjusted(
      row(
        "endBalance",
        "money",
        totals.map((t) => ({ value: t.endBalance })),
        benchmarkTotals.endBalance,
      ),
    ),
    adjusted(
      row("cagr", "percent", totals.map((t) => ({ value: t.cagr })), benchmarkTotals.cagr),
    ),
    row(
      "stdev",
      "percent",
      portfolios.map((series) => ({ value: annualizedStdev(series) })),
      annualizedStdev(benchmark),
    ),
    adjusted({
      ...row(
        "bestYear",
        "percent",
        annual.map((a) => ({ value: a.best?.value ?? null, year: a.best?.year })),
        benchmarkAnnual.best?.value ?? null,
      ),
      benchmarkYear: benchmarkAnnual.best?.year,
    }),
    adjusted({
      ...row(
        "worstYear",
        "percent",
        annual.map((a) => ({ value: a.worst?.value ?? null, year: a.worst?.year })),
        benchmarkAnnual.worst?.value ?? null,
      ),
      benchmarkYear: benchmarkAnnual.worst?.year,
    }),
    row(
      "maxDrawdown",
      "percent",
      drawdowns.map((d) => ({ value: d?.depth ?? null })),
      benchmarkDrawdown?.depth ?? null,
    ),
    row(
      "sharpe",
      "ratio",
      portfolios.map((series) => ({ value: sharpe(series, riskFree) })),
      sharpe(benchmark, riskFree),
    ),
    row(
      "sortino",
      "ratio",
      sortinos.map((value) => ({
        value,
        unavailableReason: value === null ? "summary.noDownside" : undefined,
      })),
      sortino(benchmark, riskFree),
    ),
  ]

  const inflationGapYears = [
    ...new Set([...totals.flatMap((t) => t.missingYears), ...benchmarkTotals.missingYears]),
  ].sort((a, b) => a - b)

  // ทุกพอร์ตอยู่บนช่วงเวลาร่วมเดียวกันแล้ว จำนวนเดือนจึงเท่ากันทุกชุด
  return { rows, months: portfolios[0]?.length ?? 0, inflationGapYears }

  function adjusted(target: SummaryRow): SummaryRow {
    return adjusting ? { ...target, adjusted: true } : target
  }
}

function row(
  metric: string,
  format: MetricFormat,
  cells: Array<{ value: number | null; year?: number; unavailableReason?: string }>,
  benchmark: number | null,
): SummaryRow {
  return {
    metric,
    format,
    benchmark,
    portfolios: cells.map((cell) => ({
      ...cell,
      comparison: compare(metric, cell.value, benchmark),
    })),
  }
}

function compare(
  metric: string,
  portfolio: number | null,
  benchmark: number | null,
): SummaryCell["comparison"] {
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
