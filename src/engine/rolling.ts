import type { MonthlyReturn } from "@/types/series"
import { annualizeGrowth } from "./metrics"

/**
 * ผลตอบแทนแบบหน้าต่างเลื่อน (US-20)
 *
 * ตอบคำถามว่า "ถ้าเริ่มลงทุนเดือนไหนก็ได้แล้วถือครบตามระยะที่กำหนด ผลจะอยู่ในช่วงไหน" —
 * ต่างจากผลตอบแทนต่อปีที่แสดงอยู่ ซึ่งคิดจากจังหวะเข้า **จังหวะเดียว** คือต้นช่วงถึงท้ายช่วง
 *
 * ค่าทุกตัวอยู่ในชั้นคำนวณเพราะ epic บังคับไว้ว่านิยามที่ไม่ได้อยู่ที่นี่จะถูกตีความใหม่
 * ครั้งหน้าที่มีคนแตะ แม้จะดูเป็นการบวกเลขธรรมดาก็ตาม
 */

/** ระยะถือที่รองรับ เป็นจำนวนเดือน — 1 · 3 · 5 · 10 ปี (BR-CMP-64) */
export const ROLLING_WINDOWS = [12, 36, 60, 120] as const

export type RollingStats = {
  windowMonths: number
  /** จำนวนหน้าต่างที่คำนวณได้ — 0 เมื่อช่วงข้อมูลสั้นกว่าหน้าต่าง (BR-CMP-69) */
  count: number
  min: number | null
  max: number | null
  /**
   * ค่าเฉลี่ยเลขคณิตของผลตอบแทนต่อปีของ**ทุกหน้าต่าง** ไม่ใช่ผลตอบแทนทบต้นของทั้งช่วง
   * สองค่านี้ต่างกันและถูกสับสนบ่อย จึงต้องมีคำอธิบายกำกับบนจอ (BR-CMP-68)
   */
  average: number | null
  /** สัดส่วนหน้าต่างที่ให้ผลเป็นบวก 0 ถึง 1 (BR-CMP-67) */
  positiveShare: number | null
}

/**
 * ผลตอบแทนต่อปีของทุกหน้าต่างที่ยาวเท่ากับ `windowMonths` เลื่อนทีละหนึ่งเดือน (BR-CMP-65)
 *
 * ช่วง 174 เดือนกับหน้าต่าง 60 เดือน ให้ 115 ชุด (174 − 60 + 1)
 * แต่ละชุดคิดด้วยสูตรเดียวกับผลตอบแทนต่อปีแบบทบต้น ใช้กับช่วงที่สั้นลง (BR-CMP-66)
 */
export function rollingWindows(returns: MonthlyReturn[], windowMonths: number): number[] {
  if (windowMonths <= 0 || returns.length < windowMonths) return []

  const values: number[] = []
  for (let start = 0; start + windowMonths <= returns.length; start++) {
    let growth = 1
    for (let i = start; i < start + windowMonths; i++) growth *= 1 + returns[i].value
    // สูตรมีที่อยู่เดียวในโปรเจกต์ (BR-ENG-05) — ที่นี่แค่เรียกใช้
    const annual = annualizeGrowth(growth, windowMonths)
    if (annual !== null) values.push(annual)
  }
  return values
}

/** ค่าสรุปของหน้าต่างหนึ่งขนาด — ค่าที่คำนวณไม่ได้คืน null ไม่ใช่ 0 (BR-ENG-15) */
export function rollingStats(returns: MonthlyReturn[], windowMonths: number): RollingStats {
  const values = rollingWindows(returns, windowMonths)
  if (values.length === 0) {
    return { windowMonths, count: 0, min: null, max: null, average: null, positiveShare: null }
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  const positive = values.filter((value) => value > 0).length

  return {
    windowMonths,
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    average: total / values.length,
    positiveShare: positive / values.length,
  }
}
