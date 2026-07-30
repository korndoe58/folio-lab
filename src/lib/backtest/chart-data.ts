import {
  annualReturns,
  drawdownPeriods,
  growthSeries,
  realAnnualReturns,
  underwaterSeries,
  type DrawdownPeriod,
} from "@/engine"
import { parseYearMonth, type MonthlyReturn, type YearMonth } from "@/types/series"
import type { InflationInput } from "./summary"

/**
 * ประกอบข้อมูลกราฟจากผลตอบแทนรายเดือน — ทุกค่ามาจากชั้นคำนวณ (BR-GRW-07, BR-ANN-07)
 * ไฟล์นี้ทำได้แค่จัดรูปให้กราฟใช้ ไม่มีการคำนวณทางการเงินใหม่
 *
 * ทุกพอร์ตต้องถูกตัดให้เป็นช่วงเวลาร่วมเดียวกันมาแล้ว รวมทั้งตัวเทียบ (BR-CMP-04)
 * มิฉะนั้นเป็นการเทียบคนละช่วง
 */

/** คีย์ของพอร์ตลำดับนั้นในจุดข้อมูลของกราฟ — ไลบรารีกราฟต้องการคีย์แบน ไม่รับอาร์เรย์ */
export const seriesKey = (index: number) => `p${index}` as const

/**
 * คีย์แบนที่ไลบรารีกราฟอ่าน — `values` คือชุดเดียวกันในรูปที่โค้ดอื่นใช้ได้โดยไม่เสียชนิด
 * มีทั้งสองรูปเพราะไลบรารีกราฟรับได้เฉพาะคีย์แบน แต่การอ่านด้วยดัชนีพอร์ตอ่านง่ายกว่ามาก
 */
type FlatSeries = { [key: `p${number}`]: number | null } & {
  [key: `c${number}`]: number | null
}

export type GrowthChartPoint = FlatSeries & {
  /** null = จุดตั้งต้นก่อนเดือนแรกของช่วง (BR-ENG-04) */
  month: YearMonth | null
  /** มูลค่าของแต่ละพอร์ต ณ เดือนนั้น เรียงตามลำดับพอร์ต */
  values: Array<number | null>
  /** เงินที่ใส่สะสม ณ เดือนนั้น — null เมื่อพอร์ตนั้นไม่มีเงินเข้าออก (AC-CMP-31) */
  contributions: Array<number | null>
  benchmark: number | null
}

/** คีย์ของเส้นเงินที่ใส่สะสมของพอร์ตลำดับนั้น */
export const contributionKey = (index: number) => `c${index}` as const

export type GrowthInput = {
  /** เส้นมูลค่าที่ชั้นคำนวณเดินมาแล้ว รวมเงินเข้าออก (BR-CMP-39) */
  values: Array<Array<{ month: YearMonth | null; value: number }>>
  /** เงินที่ใส่สะสมของแต่ละพอร์ต — null เมื่อพอร์ตนั้นไม่มีเงินเข้าออก */
  contributions: Array<number[] | null>
}

export type YearEndRow = {
  year: number
  /** เดือนสุดท้ายของปีนั้นที่มีข้อมูล — ปีสุดท้ายอาจไม่ใช่ธันวาคม */
  month: YearMonth
  /** มูลค่า ณ สิ้นปีของแต่ละพอร์ต เรียงตามลำดับพอร์ต */
  values: Array<number | null>
  /** เงินที่ใส่สะสม ณ สิ้นปีนั้น — null เมื่อพอร์ตนั้นไม่มีเงินเข้าออก (AC-CMP-31) */
  contributions: Array<number | null>
  benchmark: number | null
}

export type GrowthData = {
  points: GrowthChartPoint[]
  /** ตารางเทียบเท่าสำหรับโปรแกรมอ่านหน้าจอ (BR-GRW-05) — มูลค่า ณ สิ้นปี */
  yearEnd: YearEndRow[]
  /** ป้ายปีที่ควรแสดงบนแกนเวลา คัดมาไม่เกิน ~8 ตัวกันป้ายทับกันบนจอแคบ */
  yearTicks: YearMonth[]
  /** สเกลลอการิทึมใช้ไม่ได้เมื่อ**พอร์ตใดก็ตาม**มีมูลค่าเป็นศูนย์หรือติดลบ (BR-GRW-08, BR-CMP-32) */
  logDisabled: boolean
}

export function buildGrowthData(
  portfolios: MonthlyReturn[][],
  benchmark: MonthlyReturn[],
  amount: number,
  input?: GrowthInput,
): GrowthData {
  // ไม่ส่งเส้นมูลค่ามา = ไม่มีเงินเข้าออก จึงคิดจากผลตอบแทนล้วน ๆ ได้เหมือนเดิม
  const growth = input?.values ?? portfolios.map((series) => growthSeries(series, amount))
  const contributions = input?.contributions ?? portfolios.map(() => null)
  const benchmarkByMonth = new Map<YearMonth | null, number>(
    growthSeries(benchmark, amount).map((p) => [p.month, p.value]),
  )

  // ทุกพอร์ตอยู่บนช่วงเดียวกันแล้ว จึงใช้ชุดแรกเป็นแกนเวลาได้
  const timeline = growth[0] ?? []
  const points: GrowthChartPoint[] = timeline.map((point, i) => {
    const values = growth.map((series) => series[i]?.value ?? null)
    const contributed = contributions.map((line) => line?.[i] ?? null)
    const row: GrowthChartPoint = {
      month: point.month,
      values,
      contributions: contributed,
      benchmark: benchmarkByMonth.get(point.month) ?? null,
    }
    values.forEach((value, p) => {
      row[seriesKey(p)] = value
    })
    contributed.forEach((value, p) => {
      row[contributionKey(p)] = value
    })
    return row
  })

  const yearEnd: YearEndRow[] = []
  for (const point of points) {
    if (point.month === null) continue
    const { year } = parseYearMonth(point.month)
    const row: YearEndRow = {
      year,
      month: point.month,
      values: point.values,
      contributions: point.contributions,
      benchmark: point.benchmark,
    }
    const last = yearEnd[yearEnd.length - 1]
    if (last && last.year === year) yearEnd[yearEnd.length - 1] = row
    else yearEnd.push(row)
  }

  const yearTicks = pickYearTicks(points.map((p) => p.month))

  // สเกลลอการิทึมใช้ไม่ได้เมื่อ**เส้นใดก็ตาม**แตะศูนย์หรือติดลบ ไม่ใช่เฉพาะพอร์ตแรก (BR-CMP-32)
  const logDisabled = points.some(
    (point) =>
      point.values.some((value) => value !== null && value <= 0) ||
      (point.benchmark !== null && point.benchmark <= 0),
  )

  return { points, yearEnd, yearTicks, logDisabled }
}

/** คัดป้ายปีบนแกนเวลาไม่เกิน ~8 ตัว เพื่อไม่ให้ป้ายทับกันบนจอแคบ */
function pickYearTicks(months: (YearMonth | null)[]): YearMonth[] {
  const januaries = months.filter((m): m is YearMonth => m !== null && m.endsWith("-01"))
  const step = Math.max(1, Math.ceil(januaries.length / 8))
  return januaries.filter((_, i) => i % step === 0)
}

export type AnnualChartRow = FlatSeries & {
  year: number
  /** ผลตอบแทนของแต่ละพอร์ตในปีนั้น เรียงตามลำดับพอร์ต */
  values: Array<number | null>
  /** จำนวนเดือนที่มีข้อมูล เมื่อปีนั้นไม่เต็ม (BR-ANN-03) — undefined เมื่อปีเต็ม */
  months: Array<number | undefined>
  benchmark: number | null
  benchmarkMonths?: number
}

export type AnnualData = {
  rows: AnnualChartRow[]
}

export function buildAnnualData(
  portfolios: MonthlyReturn[][],
  benchmark: MonthlyReturn[],
  inflation?: InflationInput,
): AnnualData {
  // ปรับทั้งทุกพอร์ตและตัวเทียบพร้อมกันเสมอ ไม่งั้นเป็นการเทียบคนละหน่วย (BR-INF-04)
  const yearly = (series: MonthlyReturn[]) => {
    const annual = annualReturns(series)
    return inflation?.enabled === true ? realAnnualReturns(annual, inflation.rates) : annual
  }

  const byPortfolio = portfolios.map((series) => new Map(yearly(series).map((a) => [a.year, a])))
  const benchmarkAnnual = new Map(yearly(benchmark).map((a) => [a.year, a]))

  const years = [
    ...new Set([...byPortfolio.flatMap((m) => [...m.keys()]), ...benchmarkAnnual.keys()]),
  ].sort((a, b) => a - b)

  const rows: AnnualChartRow[] = years.map((year) => {
    const b = benchmarkAnnual.get(year)
    const values = byPortfolio.map((m) => m.get(year)?.value ?? null)
    const row: AnnualChartRow = {
      year,
      values,
      months: byPortfolio.map((m) => {
        const entry = m.get(year)
        return entry?.partial ? entry.monthsCovered : undefined
      }),
      benchmark: b?.value ?? null,
      benchmarkMonths: b?.partial ? b.monthsCovered : undefined,
    }
    values.forEach((value, p) => {
      row[seriesKey(p)] = value
    })
    return row
  })

  return { rows }
}

export type UnderwaterChartPoint = FlatSeries & {
  month: YearMonth
  /** สัดส่วนที่ต่ำกว่าจุดสูงสุดเดิมของแต่ละพอร์ต เป็นค่าติดลบ (0 = อยู่ที่จุดสูงสุด) */
  values: Array<number | null>
  benchmark: number | null
}

/** ช่วงขาดทุนของหนึ่งพอร์ต — แยกกันเพราะแต่ละพอร์ตมีช่วงคนละชุดที่ไม่ตรงกัน (BR-CMP-30) */
export type PortfolioDrawdowns = {
  /** ช่วงขาดทุนลึกที่สุด 5 อันดับ (BR-DDW-01) */
  worst: DrawdownPeriod[]
  /** จำนวนช่วงขาดทุนทั้งหมดที่พบ ใช้บอกผู้ใช้เมื่อมีน้อยกว่า 5 (BR-DDW-06) */
  totalPeriods: number
}

export type DrawdownData = {
  points: UnderwaterChartPoint[]
  /** ป้ายปีบนแกนเวลา คัดแบบเดียวกับกราฟมูลค่าเพื่อให้ระยะห่างสม่ำเสมอ */
  yearTicks: YearMonth[]
  /** หนึ่งชุดต่อพอร์ต เรียงตามลำดับพอร์ต */
  perPortfolio: PortfolioDrawdowns[]
}

/**
 * ข้อมูลส่วนช่วงขาดทุน (US-10) — ค่าทุกตัวมาจากชั้นคำนวณตาม BR-DDW-08
 * หน้าจอไม่หาจุดต่ำสุดหรือคำนวณเวลาฟื้นเอง
 */
export function buildDrawdownData(
  portfolios: MonthlyReturn[][],
  benchmark: MonthlyReturn[],
): DrawdownData {
  const underwater = portfolios.map(underwaterSeries)
  const benchmarkByMonth = new Map(underwaterSeries(benchmark).map((p) => [p.month, p.value]))

  const timeline = underwater[0] ?? []
  const points: UnderwaterChartPoint[] = timeline.map((point, i) => {
    const values = underwater.map((series) => series[i]?.value ?? null)
    const row: UnderwaterChartPoint = {
      month: point.month,
      values,
      benchmark: benchmarkByMonth.get(point.month) ?? null,
    }
    values.forEach((value, p) => {
      row[seriesKey(p)] = value
    })
    return row
  })

  const perPortfolio = portfolios.map((series) => {
    const all = drawdownPeriods(series)
    return { worst: all.slice(0, 5), totalPeriods: all.length }
  })

  return {
    points,
    yearTicks: pickYearTicks(points.map((p) => p.month)),
    perPortfolio,
  }
}
