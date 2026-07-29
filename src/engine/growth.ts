import type { MonthlyReturn, YearMonth } from "@/types/series"

export type GrowthPoint = {
  /** null = จุดตั้งต้นก่อนเดือนแรกของช่วง */
  month: YearMonth | null
  value: number
}

/**
 * เส้นมูลค่าพอร์ต (BR-ENG-04)
 *
 * จุดแรกคือจุดตั้งต้น "ก่อน" เดือนแรกของช่วง จากนั้นคูณด้วยผลตอบแทนของทุกเดือน
 * รวมเดือนแรกด้วย — ผลตอบแทนเดือนแรกต้องไม่ถูกข้าม
 */
export function growthSeries(returns: MonthlyReturn[], initialAmount: number): GrowthPoint[] {
  const points: GrowthPoint[] = [{ month: null, value: initialAmount }]
  let value = initialAmount
  for (const item of returns) {
    value *= 1 + item.value
    points.push({ month: item.month, value })
  }
  return points
}

export function endBalance(returns: MonthlyReturn[], initialAmount: number): number {
  let value = initialAmount
  for (const item of returns) value *= 1 + item.value
  return value
}
