import { parseYearMonth, type MonthlyReturn } from "@/types/series"
import type { AnnualReturn } from "./annual"
import { annualizeGrowth } from "./metrics"

/**
 * การปรับผลตอบแทนด้วยเงินเฟ้อ (US-15)
 *
 * ดัชนีที่มีให้ใช้มีความละเอียดแค่**รายปี** (PD-012) ทุกฟังก์ชันในไฟล์นี้จึงทำงานที่ระดับปี
 * ค่าที่นิยามบนผลตอบแทนรายเดือน — กราฟมูลค่า ความผันผวน ช่วงขาดทุน Sharpe Sortino —
 * ต้องไม่ถูกปรับ (BR-INF-07, BR-INF-08) และไม่มีฟังก์ชันในไฟล์นี้ที่ทำให้ทำได้
 */

/** อัตราเงินเฟ้อของหนึ่งปี เก็บเป็นสัดส่วน (0.0608 = 6.08%) */
export type InflationRate = {
  year: number
  value: number
}

export type CumulativeInflation = {
  /** ตัวคูณราคาสะสมของทุกปีในช่วง — 1 หมายถึงราคาไม่ขยับเลย */
  factor: number
  /** ปีที่ยังไม่มีดัชนีประกาศ ถือว่าเงินเฟ้อเป็นศูนย์แล้วรายงานกลับเพื่อแจ้งผู้ใช้ (BR-INF-09) */
  missingYears: number[]
}

/**
 * ปีตามปฏิทินที่ช่วงข้อมูลแตะ เรียงจากน้อยไปมาก
 * ใช้เป็นฐานของตัวคูณสะสม — ช่วงที่สั้นกว่าหนึ่งปีก็ยังถูกปรับด้วยเงินเฟ้อทั้งปีนั้น (EC-INF-02)
 */
export function coveredYears(returns: MonthlyReturn[]): number[] {
  const years = new Set<number>()
  for (const item of returns) years.add(parseYearMonth(item.month).year)
  return [...years].sort((a, b) => a - b)
}

/**
 * ตัวคูณราคาสะสมของทุกปีที่ระบุ = ∏ (1 + อัตราเงินเฟ้อของปีนั้น)
 * ปีที่ไม่มีดัชนี (หรือมีค่าที่ทำให้ราคาเป็นศูนย์หรือติดลบ) คูณด้วย 1 แล้วรายงานปีนั้นออกมา
 */
export function cumulativeInflation(
  years: number[],
  rates: InflationRate[],
): CumulativeInflation {
  const byYear = ratesByYear(rates)
  const missingYears: number[] = []
  let factor = 1

  for (const year of years) {
    const priceFactor = priceFactorOf(byYear, year)
    if (priceFactor === null) {
      missingYears.push(year)
      continue
    }
    factor *= priceFactor
  }

  return { factor, missingYears }
}

/**
 * ผลตอบแทนรายปีหลังหักเงินเฟ้อ (BR-INF-05) — (1 + ผลตอบแทน) ÷ (1 + เงินเฟ้อ) − 1
 *
 * ตั้งใจไม่ใช้การลบกันตรง ๆ เพราะให้ค่าที่ผิด: 10% กับเงินเฟ้อ 6% ได้ 3.77% ไม่ใช่ 4%
 * ปีที่ไม่มีดัชนีคืนค่าเดิมไม่แตะ ให้ผู้เรียกแจ้งผู้ใช้ผ่าน `cumulativeInflation` (BR-INF-09)
 */
export function realAnnualReturns(
  annual: AnnualReturn[],
  rates: InflationRate[],
): AnnualReturn[] {
  const byYear = ratesByYear(rates)
  return annual.map((item) => {
    const priceFactor = priceFactorOf(byYear, item.year)
    if (priceFactor === null) return item
    return { ...item, value: (1 + item.value) / priceFactor - 1 }
  })
}

/** มูลค่าสุดท้ายในอำนาจซื้อของเงินตั้งต้น (BR-INF-06) */
export function realEndBalance(nominalEnd: number, factor: number): number {
  return factor <= 0 ? nominalEnd : nominalEnd / factor
}

/**
 * ผลตอบแทนต่อปีแบบทบต้นหลังหักเงินเฟ้อ (BR-INF-06)
 * คำนวณใหม่จากมูลค่าที่ปรับแล้วด้วยสูตรเดิมของ BR-ENG-05 ไม่ใช่การหักออกจากค่าปกติ
 */
export function realCagr(realEnd: number, amount: number, months: number): number | null {
  if (amount <= 0) return null
  return annualizeGrowth(realEnd / amount, months)
}

function ratesByYear(rates: InflationRate[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const rate of rates) map.set(rate.year, rate.value)
  return map
}

/** (1 + เงินเฟ้อ) ของปีนั้น หรือ null เมื่อใช้ปรับไม่ได้ */
function priceFactorOf(byYear: Map<number, number>, year: number): number | null {
  const rate = byYear.get(year)
  if (rate === undefined || !Number.isFinite(rate)) return null
  const priceFactor = 1 + rate
  return priceFactor > 0 ? priceFactor : null
}
