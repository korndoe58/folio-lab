/**
 * รูปแบบการแสดงตัวเลขตาม BR-MVP-04
 * ค่าที่คำนวณไม่ได้แสดงเป็นขีด ไม่ใช่ 0 (BR-SUM-06)
 */
export const NO_VALUE = "—"

/** จำนวนเงินเป็นจำนวนเต็ม คั่นหลักพัน พร้อมกำกับสกุลดอลลาร์สหรัฐ */
export function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return NO_VALUE
  return `$${Math.round(value).toLocaleString("en-US")}`
}

/** เปอร์เซ็นต์ทศนิยม 2 ตำแหน่ง รับค่าเป็นสัดส่วน (0.1032 → "10.32%") */
export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return NO_VALUE
  return `${(value * 100).toFixed(2)}%`
}

/**
 * เปอร์เซ็นต์แบบย่อสำหรับป้ายแกนกราฟ (ไม่มีทศนิยม) — ค่าที่ต้องอ่านแม่นยำยังใช้ formatPercent
 */
export function formatPercentAxis(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return NO_VALUE
  return `${Math.round(value * 100)}%`
}

/** อัตราส่วนไร้หน่วยทศนิยม 2 ตำแหน่ง */
export function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return NO_VALUE
  return value.toFixed(2)
}
