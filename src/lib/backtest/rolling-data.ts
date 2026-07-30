import { ROLLING_WINDOWS, rollingStats, type RollingStats } from "@/engine"
import type { MonthlyReturn } from "@/types/series"

/**
 * ข้อมูลส่วนผลตอบแทนแบบหน้าต่างเลื่อน (US-20)
 *
 * ไฟล์นี้ทำได้แค่เรียกชั้นคำนวณให้ครบทุกหน้าต่าง × ทุกพอร์ต แล้วจัดเรียง —
 * ไม่มีการคำนวณทางการเงินใหม่แม้แต่การหาค่าเฉลี่ย (§5 ของ epic)
 *
 * ทุกพอร์ตต้องถูกตัดให้เป็นช่วงเวลาร่วมเดียวกันมาแล้ว จำนวนหน้าต่างจึงเท่ากันทุกพอร์ต (EC-CMP-26)
 */

export type RollingRow = {
  windowMonths: number
  /** หนึ่งชุดต่อพอร์ต เรียงตามลำดับพอร์ต */
  portfolios: RollingStats[]
}

export type RollingData = {
  rows: RollingRow[]
  /** หน้าต่างที่ยาวกว่าช่วงข้อมูล จึงยังไม่มีค่าให้แสดง — ใช้ประกอบข้อความ N-005 (BR-CMP-69) */
  unavailableWindows: number[]
}

export function buildRollingData(portfolios: MonthlyReturn[][]): RollingData {
  const rows: RollingRow[] = ROLLING_WINDOWS.map((windowMonths) => ({
    windowMonths,
    portfolios: portfolios.map((series) => rollingStats(series, windowMonths)),
  }))

  // หน้าต่างที่ไม่มีพอร์ตไหนคำนวณได้เลย = ช่วงข้อมูลสั้นกว่าหน้าต่างนั้น
  const unavailableWindows = rows
    .filter((row) => row.portfolios.every((stats) => stats.count === 0))
    .map((row) => row.windowMonths)

  return { rows, unavailableWindows }
}
