/** เดือนในรูปแบบ "YYYY-MM" — ไม่มีวันที่ ตาม BR-NRM-08 */
export type YearMonth = string

export type MonthRange = {
  start: YearMonth
  end: YearMonth
}

/** ผลตอบแทนเก็บเป็นสัดส่วนทศนิยม (0.021 = 2.1%) ตาม BR-NRM-07 */
export type MonthlyReturn = {
  month: YearMonth
  value: number
}

export type SeriesSource = "stooq" | "yahoo" | "cache" | "stub" | "mixed"

export type MonthlySeries = {
  symbol: string
  returns: MonthlyReturn[]
  /** ช่วงที่มีข้อมูลจริง อาจสั้นกว่าที่ขอตาม BR-PRV-06 — null เมื่อไม่มีเดือนใดเลย */
  actualRange: MonthRange | null
  source: SeriesSource
}

/** ความล้มเหลวสองชนิดที่ผู้เรียกต้องแยกออกจากกัน ตาม BR-FND-05 / BR-PRV-05 */
export type ProviderFailure =
  | { kind: "symbol-not-found"; symbol: string }
  | { kind: "unreachable"; symbol: string; sourcesTried: number }

export type SeriesResult =
  | { ok: true; series: MonthlySeries }
  | { ok: false; failure: ProviderFailure }

export type PriceProvider = {
  getMonthlySeries(symbol: string, range: MonthRange): Promise<SeriesResult>
  /** เดือนล่าสุดที่ปิดแล้วตาม BR-PRV-11 — คำนวณจากปฏิทิน ไม่เรียกแหล่งภายนอก */
  lastClosedMonth(): YearMonth
}

export function toYearMonth(year: number, month1to12: number): YearMonth {
  return `${year}-${String(month1to12).padStart(2, "0")}`
}

export function parseYearMonth(month: YearMonth): { year: number; month: number } {
  const [y, m] = month.split("-")
  return { year: Number(y), month: Number(m) }
}

export function compareMonths(a: YearMonth, b: YearMonth): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function shiftMonth(month: YearMonth, delta: number): YearMonth {
  const { year, month: m } = parseYearMonth(month)
  const zeroBased = year * 12 + (m - 1) + delta
  return toYearMonth(Math.floor(zeroBased / 12), (zeroBased % 12) + 1)
}

export function monthsBetween(from: YearMonth, to: YearMonth): number {
  const a = parseYearMonth(from)
  const b = parseYearMonth(to)
  return (b.year - a.year) * 12 + (b.month - a.month)
}
