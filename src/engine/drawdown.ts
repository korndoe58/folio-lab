import { monthsBetween, type MonthlyReturn, type YearMonth } from "@/types/series"
import { growthSeries } from "./growth"

export type UnderwaterPoint = {
  month: YearMonth
  /** สัดส่วนที่ต่ำกว่าจุดสูงสุดเดิม เป็นค่าติดลบ (0 = อยู่ที่จุดสูงสุด) */
  value: number
}

export type DrawdownPeriod = {
  /** เดือนแรกที่มูลค่าต่ำกว่าจุดสูงสุดเดิม */
  start: YearMonth
  /** เดือนที่ต่ำที่สุดของช่วง */
  trough: YearMonth
  /** ความลึกที่จุดต่ำสุด เป็นค่าติดลบ */
  depth: number
  /** จำนวนเดือนจากเดือนเริ่มตกถึงเดือนต่ำสุด นับรวมทั้งสองเดือน */
  lengthMonths: number
  /** เดือนที่กลับมาเท่าจุดสูงสุดเดิม — null เมื่อยังไม่ฟื้นจนจบข้อมูล (BR-ENG-08) */
  recoveredAt: YearMonth | null
  /** จำนวนเดือนจากเดือนถัดจากจุดต่ำสุดถึงเดือนที่ฟื้น — null เมื่อยังไม่ฟื้น */
  recoveryMonths: number | null
}

/** สัดส่วนที่ต่ำกว่าจุดสูงสุดเดิมของทุกเดือน (BR-ENG-16 ก) */
export function underwaterSeries(returns: MonthlyReturn[]): UnderwaterPoint[] {
  const points = growthSeries(returns, 1)
  let peak = points[0]?.value ?? 1
  const out: UnderwaterPoint[] = []

  for (const point of points) {
    if (point.month === null) continue
    if (point.value > peak) peak = point.value
    out.push({ month: point.month, value: peak > 0 ? point.value / peak - 1 : 0 })
  }
  return out
}

/**
 * ช่วงขาดทุนทุกช่วง เรียงจากลึกที่สุดไปน้อยที่สุด (BR-ENG-16 ข)
 *
 * ช่วงเริ่มเมื่อมูลค่าต่ำกว่าจุดสูงสุดเดิมครั้งแรก และจบเมื่อเดือนแรกที่กลับมา ≥ จุดสูงสุดเดิม
 * ความลึกเท่ากันให้ช่วงที่เกิดก่อนอยู่อันดับสูงกว่า เพื่อให้ผลเรียงเหมือนเดิมทุกครั้ง
 */
export function drawdownPeriods(returns: MonthlyReturn[]): DrawdownPeriod[] {
  const points = growthSeries(returns, 1).filter(
    (p): p is { month: YearMonth; value: number } => p.month !== null,
  )
  if (points.length === 0) return []

  const periods: DrawdownPeriod[] = []
  let peak = 1 // จุดตั้งต้นก่อนเดือนแรก
  let current: { start: YearMonth; trough: YearMonth; troughValue: number } | null = null

  for (const point of points) {
    if (point.value >= peak) {
      if (current) {
        periods.push(closePeriod(current, peak, point.month))
        current = null
      }
      peak = point.value
      continue
    }

    if (!current) {
      current = { start: point.month, trough: point.month, troughValue: point.value }
    } else if (point.value < current.troughValue) {
      current.trough = point.month
      current.troughValue = point.value
    }
  }

  if (current) periods.push(closePeriod(current, peak, null))

  return periods.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth // ติดลบมากกว่า = ลึกกว่า = มาก่อน
    return a.start < b.start ? -1 : 1
  })
}

/** ช่วงขาดทุนที่ลึกที่สุด (BR-ENG-07) — null เมื่อไม่เคยต่ำกว่าจุดสูงสุดเลย */
export function maxDrawdown(returns: MonthlyReturn[]): DrawdownPeriod | null {
  return drawdownPeriods(returns)[0] ?? null
}

function closePeriod(
  current: { start: YearMonth; trough: YearMonth; troughValue: number },
  peak: number,
  recoveredAt: YearMonth | null,
): DrawdownPeriod {
  return {
    start: current.start,
    trough: current.trough,
    depth: peak > 0 ? current.troughValue / peak - 1 : 0,
    lengthMonths: monthsBetween(current.start, current.trough) + 1,
    recoveredAt,
    recoveryMonths: recoveredAt === null ? null : monthsBetween(current.trough, recoveredAt),
  }
}
