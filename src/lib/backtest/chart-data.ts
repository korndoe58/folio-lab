import {
  annualReturns,
  drawdownPeriods,
  growthSeries,
  underwaterSeries,
  type DrawdownPeriod,
} from "@/engine"
import { parseYearMonth, type MonthlyReturn, type YearMonth } from "@/types/series"

/**
 * ประกอบข้อมูลกราฟจากผลตอบแทนรายเดือน — ทุกค่ามาจากชั้นคำนวณ (BR-GRW-07, BR-ANN-07)
 * ไฟล์นี้ทำได้แค่จัดรูปให้กราฟใช้ ไม่มีการคำนวณทางการเงินใหม่
 * ตัวเทียบต้องถูกตัดให้เป็นช่วงเดียวกับพอร์ตมาแล้ว (เหตุผลเดียวกับตารางสรุป)
 */

export type GrowthChartPoint = {
  /** null = จุดตั้งต้นก่อนเดือนแรกของช่วง (BR-ENG-04) */
  month: YearMonth | null
  portfolio: number
  benchmark: number | null
}

export type YearEndRow = {
  year: number
  /** เดือนสุดท้ายของปีนั้นที่มีข้อมูล — ปีสุดท้ายอาจไม่ใช่ธันวาคม */
  month: YearMonth
  portfolio: number
  benchmark: number | null
}

export type GrowthData = {
  points: GrowthChartPoint[]
  /** ตารางเทียบเท่าสำหรับโปรแกรมอ่านหน้าจอ (BR-GRW-05) — มูลค่า ณ สิ้นปี */
  yearEnd: YearEndRow[]
  /** ป้ายปีที่ควรแสดงบนแกนเวลา คัดมาไม่เกิน ~8 ตัวกันป้ายทับกันบนจอแคบ */
  yearTicks: YearMonth[]
  /** สเกลลอการิทึมใช้ไม่ได้เมื่อมีมูลค่าเป็นศูนย์หรือติดลบ (BR-GRW-08) */
  logDisabled: boolean
}

export function buildGrowthData(
  portfolio: MonthlyReturn[],
  benchmark: MonthlyReturn[],
  amount: number,
): GrowthData {
  const portfolioGrowth = growthSeries(portfolio, amount)
  const benchmarkGrowth = growthSeries(benchmark, amount)
  const benchmarkByMonth = new Map<YearMonth | null, number>(
    benchmarkGrowth.map((p) => [p.month, p.value]),
  )

  const points: GrowthChartPoint[] = portfolioGrowth.map((p) => ({
    month: p.month,
    portfolio: p.value,
    benchmark: benchmarkByMonth.get(p.month) ?? null,
  }))

  const yearEnd: YearEndRow[] = []
  for (const point of points) {
    if (point.month === null) continue
    const { year } = parseYearMonth(point.month)
    const last = yearEnd[yearEnd.length - 1]
    const row = { year, month: point.month, portfolio: point.portfolio, benchmark: point.benchmark }
    if (last && last.year === year) yearEnd[yearEnd.length - 1] = row
    else yearEnd.push(row)
  }

  const yearTicks = pickYearTicks(points.map((p) => p.month))

  const logDisabled = points.some(
    (p) => p.portfolio <= 0 || (p.benchmark !== null && p.benchmark <= 0),
  )

  return { points, yearEnd, yearTicks, logDisabled }
}

/** คัดป้ายปีบนแกนเวลาไม่เกิน ~8 ตัว เพื่อไม่ให้ป้ายทับกันบนจอแคบ */
function pickYearTicks(months: (YearMonth | null)[]): YearMonth[] {
  const januaries = months.filter((m): m is YearMonth => m !== null && m.endsWith("-01"))
  const step = Math.max(1, Math.ceil(januaries.length / 8))
  return januaries.filter((_, i) => i % step === 0)
}

export type AnnualChartRow = {
  year: number
  portfolio: number | null
  benchmark: number | null
  /** จำนวนเดือนที่มีข้อมูล เมื่อปีนั้นไม่เต็ม (BR-ANN-03) */
  portfolioMonths?: number
  benchmarkMonths?: number
}

export type AnnualData = {
  rows: AnnualChartRow[]
}

export function buildAnnualData(
  portfolio: MonthlyReturn[],
  benchmark: MonthlyReturn[],
): AnnualData {
  const portfolioAnnual = annualReturns(portfolio)
  const benchmarkAnnual = new Map(annualReturns(benchmark).map((a) => [a.year, a]))
  const years = [...new Set([...portfolioAnnual.map((a) => a.year), ...benchmarkAnnual.keys()])].sort(
    (a, b) => a - b,
  )
  const portfolioByYear = new Map(portfolioAnnual.map((a) => [a.year, a]))

  const rows: AnnualChartRow[] = years.map((year) => {
    const p = portfolioByYear.get(year)
    const b = benchmarkAnnual.get(year)
    return {
      year,
      portfolio: p?.value ?? null,
      benchmark: b?.value ?? null,
      portfolioMonths: p?.partial ? p.monthsCovered : undefined,
      benchmarkMonths: b?.partial ? b.monthsCovered : undefined,
    }
  })

  return { rows }
}

export type UnderwaterChartPoint = {
  month: YearMonth
  /** สัดส่วนที่ต่ำกว่าจุดสูงสุดเดิม เป็นค่าติดลบ (0 = อยู่ที่จุดสูงสุด) */
  portfolio: number
  benchmark: number | null
}

export type DrawdownData = {
  points: UnderwaterChartPoint[]
  /** ป้ายปีบนแกนเวลา คัดแบบเดียวกับกราฟมูลค่าเพื่อให้ระยะห่างสม่ำเสมอ */
  yearTicks: YearMonth[]
  /** ช่วงขาดทุนลึกที่สุด 5 อันดับ (BR-DDW-01) */
  worst: DrawdownPeriod[]
  /** จำนวนช่วงขาดทุนทั้งหมดที่พบ ใช้บอกผู้ใช้เมื่อมีน้อยกว่า 5 (BR-DDW-06) */
  totalPeriods: number
}

/**
 * ข้อมูลส่วนช่วงขาดทุน (US-10) — ค่าทุกตัวมาจากชั้นคำนวณตาม BR-DDW-08
 * หน้าจอไม่หาจุดต่ำสุดหรือคำนวณเวลาฟื้นเอง
 */
export function buildDrawdownData(
  portfolio: MonthlyReturn[],
  benchmark: MonthlyReturn[],
): DrawdownData {
  const portfolioUnderwater = underwaterSeries(portfolio)
  const benchmarkByMonth = new Map(underwaterSeries(benchmark).map((p) => [p.month, p.value]))

  const points: UnderwaterChartPoint[] = portfolioUnderwater.map((p) => ({
    month: p.month,
    portfolio: p.value,
    benchmark: benchmarkByMonth.get(p.month) ?? null,
  }))

  const all = drawdownPeriods(portfolio)
  return {
    points,
    yearTicks: pickYearTicks(points.map((p) => p.month)),
    worst: all.slice(0, 5),
    totalPeriods: all.length,
  }
}
