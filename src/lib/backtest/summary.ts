import {
  annualReturns,
  annualizedStdev,
  bestWorstFullYears,
  cagr,
  endBalance,
  maxDrawdown,
  sharpe,
  sortino,
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
}

export type Summary = {
  rows: SummaryRow[]
  months: number
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
}): Summary {
  const { portfolio, benchmark, riskFree, amount } = input

  const portfolioAnnual = bestWorstFullYears(annualReturns(portfolio))
  const benchmarkAnnual = bestWorstFullYears(annualReturns(benchmark))
  const portfolioDrawdown = maxDrawdown(portfolio)
  const benchmarkDrawdown = maxDrawdown(benchmark)
  const portfolioSortino = sortino(portfolio, riskFree)
  const benchmarkSortino = sortino(benchmark, riskFree)

  const rows: SummaryRow[] = [
    row("startAmount", "money", amount, amount),
    row("endBalance", "money", endBalance(portfolio, amount), endBalance(benchmark, amount)),
    row("cagr", "percent", cagr(portfolio), cagr(benchmark)),
    row("stdev", "percent", annualizedStdev(portfolio), annualizedStdev(benchmark)),
    {
      ...row("bestYear", "percent", portfolioAnnual.best?.value ?? null, benchmarkAnnual.best?.value ?? null),
      portfolioYear: portfolioAnnual.best?.year,
      benchmarkYear: benchmarkAnnual.best?.year,
    },
    {
      ...row("worstYear", "percent", portfolioAnnual.worst?.value ?? null, benchmarkAnnual.worst?.value ?? null),
      portfolioYear: portfolioAnnual.worst?.year,
      benchmarkYear: benchmarkAnnual.worst?.year,
    },
    row("maxDrawdown", "percent", portfolioDrawdown?.depth ?? null, benchmarkDrawdown?.depth ?? null),
    row("sharpe", "ratio", sharpe(portfolio, riskFree), sharpe(benchmark, riskFree)),
    {
      ...row("sortino", "ratio", portfolioSortino, benchmarkSortino),
      unavailableReason: portfolioSortino === null ? "summary.noDownside" : undefined,
    },
  ]

  return { rows, months: portfolio.length }
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
