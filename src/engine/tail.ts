import type { MonthlyReturn } from "@/types/series"
import { cagr, mean, sampleStdev } from "./metrics"
import { maxDrawdown } from "./drawdown"

/**
 * ความเสี่ยงหางและรูปร่างการกระจาย (US-31)
 *
 * **สองเรื่องที่ต่างจากที่อื่นในโปรเจกต์และพลาดได้ง่าย:**
 * 1. VaR/CVaR เป็นค่า **รายเดือน** ไม่ใช่รายปี — ไม่มีการคูณ √12 ที่ไหนในไฟล์นี้
 * 2. Skewness กับ Kurtosis ใช้สูตร**เชิงประชากร** (หาร `n`) ต่างจากส่วนเบี่ยงเบนมาตรฐาน
 *    ที่ใช้ `n−1` ทั้งโปรเจกต์ — เป็นข้อยกเว้นที่ BR-RSK-22 ระบุไว้ชัด
 *
 * วิธีคิด VaR ทั้งสองแบบและ CVaR ถูกยืนยันกับค่าอ้างอิงในภาคผนวก A ตอนเขียนการ์ดแล้ว
 * ว่ามีวิธีเดียวที่ตรง — อย่าเปลี่ยนโดยไม่เทียบใหม่
 */

const DEFAULT_TAIL = 0.05
/** ค่า z ที่เปอร์เซ็นไทล์ที่ 5 ของการแจกแจงปกติ ตามที่ BR-RSK-20 ระบุ */
const Z_AT_5_PERCENT = 1.645
/** Skewness และ Kurtosis ต้องมีอย่างน้อยเท่านี้จึงมีความหมาย (BR-RSK-26) */
const MIN_SHAPE_MONTHS = 4

const values = (returns: MonthlyReturn[]) => returns.map((item) => item.value)

/**
 * เปอร์เซ็นไทล์แบบ**ประมาณค่าเชิงเส้นบนอันดับ `p × (n − 1)`** (BR-RSK-19)
 *
 * ไม่ใช่อันดับใกล้สุด — สองวิธีนี้ให้ผลต่างกันในหลักที่สอง ซึ่งมากพอที่จะเห็นบนจอ
 * แต่น้อยพอที่จะไม่มีใครสังเกต · วิธีนี้คือวิธีที่ตรงกับค่าอ้างอิง `5.24%`
 */
function quantile(sorted: number[], p: number): number {
  const rank = p * (sorted.length - 1)
  const lower = Math.floor(rank)
  const upper = Math.ceil(rank)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (rank - lower) * (sorted[upper] - sorted[lower])
}

/**
 * ในบรรดาเดือนที่ผ่านมา มี 5% ที่ขาดทุนมากกว่าค่านี้ · **รายเดือน**
 * คืนเป็น**ขนาดของการขาดทุน (ค่าบวก)** ตาม BR-RSK-24
 */
export function historicalVaR(returns: MonthlyReturn[], p: number = DEFAULT_TAIL): number | null {
  if (returns.length < 2) return null
  const sorted = [...values(returns)].sort((a, b) => a - b)
  return -quantile(sorted, p)
}

/** ค่าเดียวกันแต่คิดจากรูปแบบการกระจาย · `ค่าเฉลี่ย − 1.645 × sd` (BR-RSK-20) */
export function analyticalVaR(returns: MonthlyReturn[]): number | null {
  if (returns.length < 2) return null
  const stdev = sampleStdev(values(returns))
  if (stdev === null) return null
  return -(mean(values(returns)) - Z_AT_5_PERCENT * stdev)
}

/**
 * เมื่อเดือนแย่ ๆ นั้นมาถึงจริง โดยเฉลี่ยขาดทุนเท่าไร · **รายเดือน**
 * เฉลี่ยจาก `ceil(0.05 × n)` เดือนที่แย่ที่สุด — **ปัดขึ้น ไม่ใช่ปัดลง** (BR-RSK-21)
 */
export function conditionalVaR(returns: MonthlyReturn[], p: number = DEFAULT_TAIL): number | null {
  if (returns.length < 2) return null
  const sorted = [...values(returns)].sort((a, b) => a - b)
  const count = Math.ceil(p * sorted.length)
  if (count === 0) return null
  return -mean(sorted.slice(0, count))
}

/** โมเมนต์กลางเชิงประชากร (หารด้วย `n`) — ฐานของ Skewness และ Kurtosis (BR-RSK-22) */
function populationMoment(list: number[], order: number): number {
  const avg = mean(list)
  return list.reduce((sum, value) => sum + (value - avg) ** order, 0) / list.length
}

/** ผลตอบแทนเอียงไปทางไหน — สูตร**เชิงประชากร** ไร้หน่วย (BR-RSK-22) */
export function skewness(returns: MonthlyReturn[]): number | null {
  const list = values(returns)
  if (list.length < MIN_SHAPE_MONTHS) return null
  const variance = populationMoment(list, 2)
  if (variance === 0) return null
  return populationMoment(list, 3) / variance ** 1.5
}

/**
 * เดือนสุดขั้วเกิดบ่อยกว่าปกติแค่ไหน — รายงานเป็น**ส่วนเกิน** คือลบ 3 แล้ว
 * การแจกแจงปกติจึงเท่ากับศูนย์ (BR-RSK-22)
 */
export function excessKurtosis(returns: MonthlyReturn[]): number | null {
  const list = values(returns)
  if (list.length < MIN_SHAPE_MONTHS) return null
  const variance = populationMoment(list, 2)
  if (variance === 0) return null
  return populationMoment(list, 4) / variance ** 2 - 3
}

/**
 * ผลตอบแทนต่อปีเทียบกับช่วงขาดทุนที่ลึกที่สุด — ไร้หน่วย (BR-RSK-23)
 * เรียกใช้ `cagr` และ `maxDrawdown` ที่ ship แล้ว ไม่เขียนสูตรซ้ำ
 */
export function calmar(returns: MonthlyReturn[]): number | null {
  const growth = cagr(returns)
  const worst = maxDrawdown(returns)
  if (growth === null || worst === null) return null
  const depth = Math.abs(worst.depth)
  // ไม่เคยขาดทุนเลย → หารด้วยศูนย์ไม่ได้ (BR-RSK-03)
  if (depth === 0) return null
  return growth / depth
}
