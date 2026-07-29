import type { MonthlyReturn, YearMonth } from "@/types/series"
import { endBalance } from "./growth"

const MONTHS_PER_YEAR = 12
const ANNUALIZE = Math.sqrt(MONTHS_PER_YEAR)

/**
 * ผลตอบแทนต่อปีแบบทบต้น (BR-ENG-05)
 * (มูลค่าสุดท้าย ÷ เงินตั้งต้น) ยกกำลัง (12 ÷ จำนวนผลตอบแทนรายเดือน) แล้วลบหนึ่ง
 */
export function cagr(returns: MonthlyReturn[]): number | null {
  if (returns.length === 0) return null
  const finalValue = endBalance(returns, 1)
  if (finalValue <= 0) return null
  return finalValue ** (MONTHS_PER_YEAR / returns.length) - 1
}

/** ความผันผวนต่อปี (BR-ENG-06): ส่วนเบี่ยงเบนมาตรฐานตัวอย่าง (n−1) ของรายเดือน × √12 */
export function annualizedStdev(returns: MonthlyReturn[]): number | null {
  const values = returns.map((r) => r.value)
  const sd = sampleStdev(values)
  return sd === null ? null : sd * ANNUALIZE
}

/**
 * Sharpe (BR-ENG-09) — ค่าเฉลี่ยผลตอบแทนส่วนเกิน ÷ ส่วนเบี่ยงเบนมาตรฐานของผลตอบแทนส่วนเกิน
 * (ตัวหาร n−1 ตาม BR-ENG-06) แล้วคูณ √12
 */
export function sharpe(returns: MonthlyReturn[], riskFree: MonthlyReturn[]): number | null {
  const excess = excessReturns(returns, riskFree)
  if (excess.length < 2) return null
  const sd = sampleStdev(excess)
  if (sd === null || sd === 0) return null
  return (mean(excess) / sd) * ANNUALIZE
}

/**
 * Sortino (BR-ENG-10) — ตัวหารเป็นส่วนเบี่ยงเบนเฉพาะด้านขาดทุน:
 * รากที่สองของค่าเฉลี่ยกำลังสองของผลตอบแทนส่วนเกินที่ติดลบ โดยหารด้วยจำนวนเดือนทั้งหมด
 * ไม่มีเดือนที่ติดลบเลย → ไม่มีค่า ไม่ใช่ 0 (BR-ENG-15)
 */
export function sortino(returns: MonthlyReturn[], riskFree: MonthlyReturn[]): number | null {
  const excess = excessReturns(returns, riskFree)
  if (excess.length < 2) return null
  const negatives = excess.filter((v) => v < 0)
  if (negatives.length === 0) return null

  const downside = Math.sqrt(
    excess.reduce((sum, v) => sum + Math.min(v, 0) ** 2, 0) / excess.length,
  )
  if (downside === 0) return null
  return (mean(excess) / downside) * ANNUALIZE
}

/** ผลตอบแทนส่วนเกิน = ผลตอบแทนพอร์ต − อัตราปราศจากความเสี่ยงของเดือนเดียวกัน (BR-ENG-11) */
function excessReturns(returns: MonthlyReturn[], riskFree: MonthlyReturn[]): number[] {
  const rfByMonth = new Map<YearMonth, number>()
  for (const item of riskFree) rfByMonth.set(item.month, item.value)
  return returns.map((r) => r.value - (rfByMonth.get(r.month) ?? 0))
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** ส่วนเบี่ยงเบนมาตรฐานแบบตัวอย่าง (ตัวหาร n−1) */
function sampleStdev(values: number[]): number | null {
  if (values.length < 2) return null
  const avg = mean(values)
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}
