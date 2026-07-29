import type { MonthlyReturn, MonthRange, YearMonth } from "@/types/series"

/**
 * คลังเก็บ "ผลตอบแทนรายเดือน" ไม่ใช่ราคา ตาม BR-CCH-01
 *
 * เหตุผล: ราคาปรับปันผลของอดีตถูกแหล่งข้อมูลเขียนทับย้อนหลังได้ทุกครั้งที่มีปันผลรอบใหม่
 * แต่อัตราส่วนระหว่างสองเดือนไม่เปลี่ยน ผลตอบแทนของเดือนที่ปิดแล้วจึงคงที่ถาวร
 */
export type ReturnsCache = {
  /** คืนเฉพาะเดือนที่มีและยังไม่หมดอายุ — เดือนที่ขาดคือหน้าที่ผู้เรียกไปดึงเพิ่ม */
  get(symbol: string, range: MonthRange): Promise<MonthlyReturn[]>
  put(symbol: string, returns: MonthlyReturn[], lastClosedMonth: YearMonth): Promise<void>
}

/** จำนวนวันปฏิทินหลังเดือนปิดที่ยังถือว่าค่าไม่นิ่ง ตาม BR-CCH-03 */
export const FRESH_MONTH_WINDOW_DAYS = 7
export const FRESH_MONTH_TTL_MS = 24 * 60 * 60 * 1000

export type CachedEntry = {
  value: number
  /** มีค่าเฉพาะเดือนที่ยังไม่นิ่ง — เดือนที่ถาวรแล้วไม่ต้องเก็บเวลา */
  storedAt?: number
}

/** เดือนที่เพิ่งปิดภายในหน้าต่างที่ยังไม่นิ่งหรือไม่ */
export function isFreshMonth(month: YearMonth, now: Date): boolean {
  const [year, m] = month.split("-").map(Number)
  const monthClosedAt = Date.UTC(year, m, 1)
  const elapsedDays = (now.getTime() - monthClosedAt) / (24 * 60 * 60 * 1000)
  return elapsedDays >= 0 && elapsedDays <= FRESH_MONTH_WINDOW_DAYS
}

export function isEntryUsable(month: YearMonth, entry: CachedEntry, now: Date): boolean {
  if (entry.storedAt === undefined) return true
  if (!isFreshMonth(month, now)) return true
  return now.getTime() - entry.storedAt < FRESH_MONTH_TTL_MS
}
