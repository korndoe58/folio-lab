import type { Currency } from "@/data/currency"

/**
 * จุดเดียวที่หน้าจอส่งเหตุการณ์การใช้งานออกไปได้ (BR-USE-02)
 *
 * เหตุผลที่ต้องรวมไว้ที่เดียว: ถ้าปล่อยให้เรียกตัวเก็บสถิติกระจายตามหน้าจอ จะไม่มีที่เดียวที่
 * ปิดสวิตช์ได้ และวันที่ต้องพิสูจน์ว่า "ชุดทดสอบไม่ส่งอะไรออกไปเลย" จะต้องไล่ทุกไฟล์
 *
 * **สิ่งที่ห้ามส่งเด็ดขาด (BR-USE-01, BR-USE-16, BR-USE-17):** จำนวนเงินที่ผู้ใช้กรอก ·
 * สัญลักษณ์ที่ผู้ใช้กรอก · ข้อความอิสระใด ๆ · ชนิดของ `EventParams` ข้างล่างจึงเป็นตัวเลขนับ
 * กับคำจากชุดที่กำหนดไว้ล่วงหน้าเท่านั้น ไม่มี `string` เปล่าที่รับอะไรก็ได้
 */

/** ชื่อเหตุการณ์ตั้งจากสิ่งที่ผู้ใช้ทำ ไม่ใช่จากชื่อ component (BR-USE-06) */
type EventParams = {
  run_backtest: {
    portfolio_count: 1 | 2 | 3
    base_currency: Currency
    /** จำนวนปี ไม่ใช่ปีเริ่ม-ปีจบ (BR-USE-17) */
    span_years: number
    inflation_adjusted: boolean
    has_cashflow: boolean
  }
  compare_portfolios: { portfolio_count: 2 | 3 }
  copy_link: Record<string, never>
  download_csv: { month_count: number }
  use_demo_portfolio: { preset: string }
  switch_language: { to: "th" | "en" }
}

export type UsageEvent = keyof EventParams

/** รูปแบบที่ตัวเก็บสถิติฝั่งเบราว์เซอร์เปิดให้เรียก */
export type Sender = (
  command: "event",
  name: string,
  params: Record<string, unknown>,
) => void

declare global {
  interface Window {
    gtag?: Sender
  }
}

/**
 * ปิดสองด่านที่**แยกจากกันโดยตั้งใจ** (BR-USE-03, BR-USE-04)
 *
 * ด่านแรกกันเครื่องของผู้พัฒนาที่ไม่ได้ตั้งค่า · ด่านที่สองกันชุดทดสอบซึ่งรันสองร้อยกว่าข้อทุกครั้ง
 * ถ้ารวมเป็นเงื่อนไขเดียว การเผลอตั้งรหัสไว้ในสภาพแวดล้อมของชุดทดสอบจะทำให้ข้อมูลปนทันที
 */
export function analyticsEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DATA_MODE === "stub") return false
  return Boolean(process.env.NEXT_PUBLIC_GA_ID)
}

/** ตัวส่งจริงฝั่งเบราว์เซอร์ — คืน undefined เมื่อสคริปต์ยังไม่พร้อมหรือถูกบล็อก (EC-USE-01) */
function browserSender(): Sender | undefined {
  return typeof window === "undefined" ? undefined : window.gtag
}

/**
 * ส่งเหตุการณ์หนึ่งครั้ง — เรียกได้เสมอโดยไม่ต้องเช็คอะไรก่อน
 *
 * เงียบสนิทเมื่อปิดอยู่ ยังไม่พร้อม หรือถูกบล็อก (BR-USE-19) — ไม่โยน ไม่เขียน console
 * เพราะสถิติที่หายหนึ่งครั้งราคาถูกกว่าหน้าเว็บที่พังหนึ่งครั้ง (EC-USE-01)
 *
 * `sender` ฉีดเข้ามาแทนได้เพื่อให้ชุดทดสอบยืนยันได้โดยไม่ต้องต่อเน็ต — รูปแบบเดียวกับที่
 * แหล่งข้อมูลราคารับ `fetchImpl` เข้ามา (BR-USE-18)
 */
export function track<E extends UsageEvent>(
  event: E,
  params: EventParams[E],
  sender: Sender | undefined = browserSender(),
): void {
  if (!analyticsEnabled()) return
  if (!sender) return
  sender("event", event, params)
}
