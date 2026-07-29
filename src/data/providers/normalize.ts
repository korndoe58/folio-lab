import {
  compareMonths,
  type MonthlyReturn,
  type MonthRange,
  type YearMonth,
} from "@/types/series"
import type { DailyRow } from "./raw-source"

export type NormalizeResult = {
  returns: MonthlyReturn[]
  actualRange: MonthRange | null
  /** เดือนสุดท้ายที่ข้อมูลยังต่อเนื่อง — ต่างจาก actualRange.end เมื่อชุดถูกตัดเพราะข้อมูลขาด (BR-NRM-06) */
  continuousThrough: YearMonth | null
  /** true เมื่อชุดถูกตัดกลางเพราะเดือนขาดหรือราคาเสีย */
  truncated: boolean
}

const EMPTY: NormalizeResult = {
  returns: [],
  actualRange: null,
  continuousThrough: null,
  truncated: false,
}

/**
 * แปลงราคารายวันแบบปรับแล้วเป็นผลตอบแทนรายเดือน (US-02)
 *
 * ราคาทุกจุดที่ใช้หารกันต้องมาจากชุดเดียวกันที่ส่งเข้ามา ตาม BR-NRM-04 — ฟังก์ชันนี้จึงรับ
 * "ชุดราคาทั้งก้อนของการดึงรอบเดียว" เท่านั้น ไม่มีทางที่ค่าจากคนละรอบจะมาหารกันได้
 */
export function normalizeToMonthlyReturns(
  rows: DailyRow[],
  lastClosedMonth: YearMonth,
): NormalizeResult {
  const monthEndPrices = pickMonthEndPrices(rows, lastClosedMonth)
  if (monthEndPrices.length < 2) return EMPTY

  const returns: MonthlyReturn[] = []
  let truncated = false

  // เดือนแรกเป็นฐานเท่านั้น ไม่มีผลตอบแทนของตัวเอง (BR-NRM-03)
  for (let i = 1; i < monthEndPrices.length; i++) {
    const previous = monthEndPrices[i - 1]
    const current = monthEndPrices[i]

    // เดือนขาดกลางชุด: ห้ามข้ามไปหารกับเดือนที่ไกลกว่า ให้ตัดที่จุดนี้ (BR-NRM-06)
    if (monthGap(previous.month, current.month) !== 1) {
      truncated = true
      break
    }
    // ราคาฐานเสีย: ถือว่าข้อมูลเสียตาม BR-NRM-09
    if (previous.price <= 0) {
      truncated = true
      break
    }

    returns.push({ month: current.month, value: current.price / previous.price - 1 })
  }

  if (returns.length === 0) return EMPTY

  const continuousThrough = returns[returns.length - 1].month
  return {
    returns,
    actualRange: { start: returns[0].month, end: continuousThrough },
    continuousThrough,
    truncated,
  }
}

type MonthEndPrice = { month: YearMonth; price: number }

/** วันทำการสุดท้ายที่มีข้อมูลของแต่ละเดือน (BR-NRM-01) — เดือนที่ยังไม่ปิดถูกตัดทิ้ง (BR-NRM-05) */
function pickMonthEndPrices(rows: DailyRow[], lastClosedMonth: YearMonth): MonthEndPrice[] {
  const latestOfMonth = new Map<YearMonth, { date: string; price: number }>()

  for (const row of rows) {
    if (!isValidRow(row)) continue
    const month = row.date.slice(0, 7)
    if (compareMonths(month, lastClosedMonth) > 0) continue

    const existing = latestOfMonth.get(month)
    // วันซ้ำหรือเรียงสลับ: ใช้ค่าของวันหลังสุดเสมอ (EC-NRM-05)
    if (!existing || row.date >= existing.date) {
      latestOfMonth.set(month, { date: row.date, price: row.adjustedClose })
    }
  }

  return [...latestOfMonth.entries()]
    .map(([month, { price }]) => ({ month, price }))
    .sort((a, b) => compareMonths(a.month, b.month))
}

function isValidRow(row: DailyRow): boolean {
  return (
    typeof row.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
    Number.isFinite(row.adjustedClose)
  )
}

function monthGap(from: YearMonth, to: YearMonth): number {
  const [fy, fm] = from.split("-").map(Number)
  const [ty, tm] = to.split("-").map(Number)
  return (ty - fy) * 12 + (tm - fm)
}
