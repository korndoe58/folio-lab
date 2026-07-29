import type { MonthRange } from "@/types/series"

/** ราคาปิดแบบปรับปันผลแล้วของวันหนึ่ง — หน่วยดิบก่อนแปลงเป็นผลตอบแทน */
export type DailyRow = {
  /** "YYYY-MM-DD" */
  date: string
  adjustedClose: number
}

export type RawFetchResult =
  | { ok: true; rows: DailyRow[] }
  /** แหล่งข้อมูลยืนยันว่าไม่มีสัญลักษณ์นี้ — ห้ามลองแหล่งสำรองต่อ ตาม BR-PRV-04 */
  | { ok: false; reason: "symbol-not-found" }
  /** ติดต่อไม่ได้ / ตอบไม่ครบ / รูปแบบผิด — ลองแหล่งสำรองได้ ตาม BR-PRV-03 */
  | { ok: false; reason: "technical"; detail?: string }

/** สัญญาภายในชั้นข้อมูล: หนึ่ง implementation ต่อหนึ่งแหล่งข้อมูลภายนอก */
export type RawPriceSource = {
  name: string
  fetchDaily(symbol: string, range: MonthRange, signal?: AbortSignal): Promise<RawFetchResult>
}
