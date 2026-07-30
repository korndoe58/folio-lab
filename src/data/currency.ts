import type { MonthlyReturn } from "@/types/series"

/**
 * สกุลเงินและการแปลงผลตอบแทนข้ามสกุล (US-12)
 *
 * ไฟล์นี้เป็นฟังก์ชันบริสุทธิ์ทั้งหมด — ไม่ติดต่อภายนอก ไม่อ่านเวลา
 * การแปลงเกิดที่ชั้นข้อมูลก่อนส่งเข้าชั้นคำนวณ ชั้นคำนวณจึงไม่รู้จักสกุลเงินเลย (BR-THB-03)
 */

export type Currency = "THB" | "USD"

/** อัตราแลกเปลี่ยนที่ใช้ทั้งระบบคือ "บาทต่อดอลลาร์" */
export const FX_SYMBOL = "THB=X"

const THAI_SUFFIX = ".BK"

/**
 * สกุลเงินของสินทรัพย์ อ่านจากรูปแบบสัญลักษณ์ (BR-FX-01)
 *
 * ข้อจำกัดที่ตั้งใจ: รองรับสองสกุล สัญลักษณ์ของตลาดอื่นจะถูกถือว่าเป็นดอลลาร์
 */
export function currencyOf(symbol: string): Currency {
  return symbol.trim().toUpperCase().endsWith(THAI_SUFFIX) ? "THB" : "USD"
}

/** ต้องใช้อัตราแลกเปลี่ยนไหม — ใช้ตัดสินว่าจะเรียกข้อมูลเพิ่มหรือไม่ (BR-FX-06) */
export function needsFx(symbols: string[], base: Currency): boolean {
  return symbols.some((symbol) => currencyOf(symbol) !== base)
}

/**
 * แปลงผลตอบแทนของสินทรัพย์หนึ่งให้เป็นมุมมองของสกุลเงินฐาน (BR-FX-03, BR-FX-04)
 *
 * สินทรัพย์ดอลลาร์มองเป็นบาท: (1 + ผลตอบแทน) × (1 + การเปลี่ยนแปลงค่าเงิน) − 1
 * สินทรัพย์บาทมองเป็นดอลลาร์: (1 + ผลตอบแทน) ÷ (1 + การเปลี่ยนแปลงค่าเงิน) − 1
 *
 * สกุลเดิมตรงกับสกุลฐานอยู่แล้ว → คืนชุดเดิมโดยไม่แตะเลย (BR-FX-05)
 * เดือนที่ไม่มีอัตราแลกเปลี่ยน หรืออัตราที่ทำให้หารด้วยศูนย์ → ตัดทิ้ง (BR-FX-09, EC-FX-02)
 */
export function convertReturns(
  returns: MonthlyReturn[],
  fxReturns: MonthlyReturn[],
  from: Currency,
  base: Currency,
): MonthlyReturn[] {
  if (from === base) return returns

  const fxByMonth = new Map(fxReturns.map((item) => [item.month, item.value]))
  const converted: MonthlyReturn[] = []

  for (const item of returns) {
    const fx = fxByMonth.get(item.month)
    if (fx === undefined || !Number.isFinite(fx)) continue

    const fxFactor = 1 + fx
    if (base === "THB") {
      converted.push({ month: item.month, value: (1 + item.value) * fxFactor - 1 })
      continue
    }

    // ค่าเงินที่ตกจนเป็นศูนย์ทำให้หารไม่ได้ ถือเป็นข้อมูลเสียของเดือนนั้น
    if (fxFactor === 0) continue
    converted.push({ month: item.month, value: (1 + item.value) / fxFactor - 1 })
  }

  return converted
}
