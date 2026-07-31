import type { MonthlyReturn, YearMonth } from "@/types/series"
import { mean, sampleStdev } from "./metrics"

/**
 * เมทริกที่เทียบพอร์ตกับตัวเทียบ (US-30)
 *
 * **ทุกค่าในไฟล์นี้คิดจากผลตอบแทนดิบ ไม่ใช่ผลตอบแทนส่วนเกิน** (BR-RSK-17 ฉบับแก้)
 * ต่างจาก Sharpe และ Sortino ที่หักอัตราปราศจากความเสี่ยงก่อน — เป็นความต่างที่ตั้งใจ
 * และ**ยืนยันกับค่าอ้างอิงแล้ว**: Alpha จากผลตอบแทนดิบได้ `−1.3569%` ตรงกับต้นแบบ `−1.36%`
 * ขณะที่จากผลตอบแทนส่วนเกินได้ `−1.70%` ซึ่งห่างเกินเกณฑ์ ([PD-024](../../docs/product/decision-log.md))
 *
 * ตัวหารของส่วนเบี่ยงเบนใช้ `n−1` ทุกที่ผ่าน `sampleStdev` ตัวเดียวกับที่ ship แล้ว (BR-RSK-09)
 */

const MONTHS_PER_YEAR = 12
const ANNUALIZE = Math.sqrt(MONTHS_PER_YEAR)
/** เล็กกว่านี้ถือว่าไม่แกว่งเลย — ผลตอบแทนรายเดือนอยู่ระดับ `1e-2` เศษทศนิยมจึงอยู่ไกลมาก */
const NEAR_ZERO = 1e-12

/** จับคู่สองชุดตามเดือน — กันการเทียบคนละเดือนเมื่อชุดใดชุดหนึ่งมีรูโหว่ */
function pairByMonth(a: MonthlyReturn[], b: MonthlyReturn[]): { a: number[]; b: number[] } {
  const byMonth = new Map<YearMonth, number>()
  for (const item of b) byMonth.set(item.month, item.value)

  const left: number[] = []
  const right: number[] = []
  for (const item of a) {
    const other = byMonth.get(item.month)
    if (other === undefined) continue
    left.push(item.value)
    right.push(other)
  }
  return { a: left, b: right }
}

/** ความแปรปรวนร่วมแบบตัวอย่าง (ตัวหาร n−1 ตาม BR-RSK-09) */
function sampleCovariance(a: number[], b: number[]): number | null {
  if (a.length < 2) return null
  const avgA = mean(a)
  const avgB = mean(b)
  const sum = a.reduce((total, value, i) => total + (value - avgA) * (b[i] - avgB), 0)
  return sum / (a.length - 1)
}

/** ตลาดขยับหนึ่งหน่วย พอร์ตขยับกี่หน่วย — ไร้หน่วย (BR-RSK-10) */
export function beta(returns: MonthlyReturn[], benchmark: MonthlyReturn[]): number | null {
  const paired = pairByMonth(returns, benchmark)
  const covariance = sampleCovariance(paired.a, paired.b)
  const benchmarkStdev = sampleStdev(paired.b)
  if (covariance === null || benchmarkStdev === null) return null
  const variance = benchmarkStdev ** 2
  // ตัวเทียบที่ไม่ขยับเลย → หารด้วยศูนย์ไม่ได้ (BR-RSK-03)
  if (variance === 0) return null
  return covariance / variance
}

/** ส่วนที่ทำได้เกินหรือต่ำกว่าที่ควรเป็นเมื่อเทียบกับความเสี่ยงที่รับ · **รายปี** (BR-RSK-11) */
export function alpha(returns: MonthlyReturn[], benchmark: MonthlyReturn[]): number | null {
  const slope = beta(returns, benchmark)
  if (slope === null) return null
  const paired = pairByMonth(returns, benchmark)
  if (paired.a.length === 0) return null
  // แปลงเป็นรายปีด้วยการ**คูณ 12** ต่างจาก Tracking Error ที่คูณ √12
  return (mean(paired.a) - slope * mean(paired.b)) * MONTHS_PER_YEAR
}

/** การขึ้นลงของพอร์ตอธิบายได้ด้วยตลาดกี่ส่วน — ไร้หน่วย แสดงเป็นเปอร์เซ็นต์ (BR-RSK-12) */
export function rSquared(returns: MonthlyReturn[], benchmark: MonthlyReturn[]): number | null {
  const paired = pairByMonth(returns, benchmark)
  const covariance = sampleCovariance(paired.a, paired.b)
  const portfolioStdev = sampleStdev(paired.a)
  const benchmarkStdev = sampleStdev(paired.b)
  if (covariance === null || portfolioStdev === null || benchmarkStdev === null) return null
  if (portfolioStdev === 0 || benchmarkStdev === 0) return null
  const correlation = covariance / (portfolioStdev * benchmarkStdev)
  return correlation ** 2
}

/** ส่วนต่างพอร์ตลบตัวเทียบรายเดือน — วัตถุดิบของ Tracking Error และ Information Ratio */
function activeReturns(returns: MonthlyReturn[], benchmark: MonthlyReturn[]): number[] {
  const paired = pairByMonth(returns, benchmark)
  return paired.a.map((value, i) => value - paired.b[i])
}

/** พอร์ตเดินห่างจากตลาดแบบไม่แน่นอนแค่ไหน · **รายปี** คูณ √12 (BR-RSK-13) */
export function trackingError(
  returns: MonthlyReturn[],
  benchmark: MonthlyReturn[],
): number | null {
  const stdev = sampleStdev(activeReturns(returns, benchmark))
  return stdev === null ? null : stdev * ANNUALIZE
}

/** ที่เดินต่างจากตลาดไป คุ้มกับความไม่แน่นอนที่เพิ่มขึ้นไหม — ไร้หน่วย (BR-RSK-14) */
export function informationRatio(
  returns: MonthlyReturn[],
  benchmark: MonthlyReturn[],
): number | null {
  const active = activeReturns(returns, benchmark)
  if (active.length === 0) return null
  const error = trackingError(returns, benchmark)
  /**
   * ชนะตัวเทียบคงที่ทุกเดือน → ส่วนต่างไม่แกว่งเลย → ตัวหารศูนย์ → ไม่มีค่า ไม่ใช่อนันต์
   * เทียบกับค่าเล็กมากแทนศูนย์เป๊ะ เพราะการลบเลขทศนิยมทิ้งเศษระดับ `1e-18` ไว้
   * ซึ่งจะกลายเป็นอัตราส่วนมหาศาลแทนที่จะเป็น "ไม่มีค่า"
   */
  if (error === null || error < NEAR_ZERO) return null
  return (mean(active) * MONTHS_PER_YEAR) / error
}

/**
 * ผลตอบแทนทบต้นของชุดเดือน **แปลงเป็นรายปี** — `(∏(1+r))^(12/n) − 1`
 *
 * ต้องแปลงเป็นรายปีก่อนหาร ไม่ใช่หารผลทบต้นทั้งช่วงตรง ๆ เพราะฝั่งขาขึ้นกับขาลง
 * มีจำนวนเดือนไม่เท่ากัน การทบต้นจึงเทียบกันไม่ได้ถ้าไม่ปรับให้เป็นหน่วยเดียวกัน ·
 * **ยืนยันกับค่าอ้างอิงแล้ว**: วิธีนี้ได้ `72.18%`/`85.25%` ตรงกับต้นแบบ `72.19%`/`85.27%`
 * ส่วนการหารผลทบต้นทั้งช่วงได้ `37.47%`/`92.89%` ซึ่งห่างมาก ([PD-024](../../docs/product/decision-log.md))
 */
function annualizedCompound(values: number[]): number {
  const growth = values.reduce((total, value) => total * (1 + value), 1)
  return growth ** (MONTHS_PER_YEAR / values.length) - 1
}

export type CaptureRatios = {
  /** เดือนที่ตลาดขึ้น พอร์ตได้ตามไปกี่ส่วน — null เมื่อไม่มีเดือนแบบนั้นเลย (BR-RSK-16) */
  upside: number | null
  downside: number | null
}

/** ตามตลาดขาขึ้นและขาลงกี่ส่วน · คิดจากผลตอบแทน**ดิบ** (BR-RSK-15, BR-RSK-17) */
export function captureRatios(
  returns: MonthlyReturn[],
  benchmark: MonthlyReturn[],
): CaptureRatios {
  const paired = pairByMonth(returns, benchmark)

  const side = (keep: (benchmarkValue: number) => boolean): number | null => {
    const portfolioSide: number[] = []
    const benchmarkSide: number[] = []
    paired.b.forEach((benchmarkValue, i) => {
      if (!keep(benchmarkValue)) return
      portfolioSide.push(paired.a[i])
      benchmarkSide.push(benchmarkValue)
    })
    if (benchmarkSide.length === 0) return null
    const benchmarkGrowth = annualizedCompound(benchmarkSide)
    if (benchmarkGrowth === 0) return null
    return annualizedCompound(portfolioSide) / benchmarkGrowth
  }

  return {
    upside: side((value) => value > 0),
    downside: side((value) => value < 0),
  }
}
