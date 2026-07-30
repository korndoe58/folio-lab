import { describe, expect, test } from "vitest"
import { cagr } from "./metrics"
import { rollingStats, rollingWindows } from "./rolling"
import { toYearMonth, type MonthlyReturn } from "@/types/series"

/**
 * ทุกเคสในไฟล์นี้คำนวณมือประกบได้ตาม R16 — ชุดข้อมูลเล็กพอที่จะไล่ด้วยกระดาษ
 * เคสที่สำคัญที่สุดคือเคสสุดท้าย ที่พิสูจน์ว่า "เฉลี่ยของหน้าต่าง" กับ "ผลตอบแทนทบต้นของทั้งช่วง"
 * เป็นคนละค่ากันจริง — ถ้าเคสนั้นเขียวโดยที่สองค่าเท่ากัน แปลว่าเราคำนวณผิดข้อใดข้อหนึ่ง
 */
const series = (values: number[]): MonthlyReturn[] =>
  values.map((value, i) => ({ month: toYearMonth(2020 + Math.floor(i / 12), (i % 12) + 1), value }))

/** ชุดคงที่ +1% ต่อเดือน — ทุกหน้าต่างต้องได้ค่าเท่ากันหมดไม่ว่าจะเริ่มเดือนไหน */
const FLAT = series(Array.from({ length: 24 }, () => 0.01))

describe("US-20 ผลตอบแทนแบบหน้าต่างเลื่อน", () => {
  test("AC-CMP-66 ชุดคงที่ 1% ต่อเดือน หน้าต่าง 1 ปี ได้ 1.01^12 − 1 ทุกชุด", () => {
    const stats = rollingStats(FLAT, 12)
    const expected = 1.01 ** 12 - 1

    expect(stats.min).toBeCloseTo(expected, 12)
    expect(stats.max).toBeCloseTo(expected, 12)
    expect(stats.average).toBeCloseTo(expected, 12)
    // 12.68% ตามที่การ์ดระบุ
    expect((expected * 100).toFixed(2)).toBe("12.68")
    expect(stats.positiveShare).toBe(1)
  })

  test("AC-CMP-67 ชุด 24 เดือน หน้าต่าง 12 เดือน ได้ 13 ชุด (24 − 12 + 1)", () => {
    expect(rollingWindows(FLAT, 12)).toHaveLength(13)
    expect(rollingStats(FLAT, 12).count).toBe(13)
  })

  test("BR-CMP-65 จำนวนชุดเท่ากับ n − w + 1 ทุกขนาดหน้าต่าง", () => {
    const long = series(Array.from({ length: 174 }, (_, i) => (i % 7) * 0.004 - 0.008))
    expect(rollingStats(long, 60).count).toBe(115)
    expect(rollingStats(long, 12).count).toBe(163)
    expect(rollingStats(long, 120).count).toBe(55)
  })

  test("EC-CMP-23 ช่วงยาวเท่าหน้าต่างพอดี ได้ชุดเดียวและเท่ากับผลตอบแทนต่อปีของทั้งช่วง", () => {
    const twelve = series([0.03, -0.01, 0.02, 0.04, -0.02, 0.01, 0.05, -0.03, 0.02, 0.01, 0, 0.02])
    const stats = rollingStats(twelve, 12)

    expect(stats.count).toBe(1)
    expect(stats.min).toBe(stats.max)
    expect(stats.average).toBeCloseTo(cagr(twelve)!, 12)
  })

  test("EC-CMP-24 · BR-CMP-69 ช่วงสั้นกว่าหน้าต่าง ไม่มีค่าให้แสดง ไม่ใช่ศูนย์", () => {
    const short = series(Array.from({ length: 11 }, () => 0.01))
    const stats = rollingStats(short, 12)

    expect(stats.count).toBe(0)
    expect(stats.min).toBeNull()
    expect(stats.max).toBeNull()
    expect(stats.average).toBeNull()
    expect(stats.positiveShare).toBeNull()
  })

  test("EC-CMP-25 ทุกหน้าต่างติดลบ สัดส่วนที่เป็นบวกเป็น 0 และค่าสูงสุดยังติดลบ", () => {
    const down = series(Array.from({ length: 24 }, () => -0.01))
    const stats = rollingStats(down, 12)

    expect(stats.positiveShare).toBe(0)
    // ไม่ถูกตัดที่ศูนย์ — ค่าสูงสุดของชุดที่ติดลบทั้งหมดก็ยังต้องติดลบ
    expect(stats.max).toBeLessThan(0)
    expect(stats.max).toBeCloseTo(0.99 ** 12 - 1, 12)
  })

  test("BR-CMP-68 ค่าเฉลี่ยของหน้าต่างไม่ใช่ผลตอบแทนทบต้นของทั้งช่วง", () => {
    /**
     * ขึ้นแรงครึ่งแรกแล้วลงครึ่งหลัง — จังหวะเข้าจึงมีผลมาก
     *
     * ระวัง: ชุดที่สลับขึ้นลงเป็นคาบ (เช่น +8% สลับ −5%) ใช้พิสูจน์ข้อนี้ไม่ได้
     * เพราะหน้าต่าง 12 เดือนไม่ว่าจะเริ่มเดือนไหนก็มีขึ้น 6 ลง 6 เท่ากันหมด
     * ทุกหน้าต่างจึงได้ค่าเดียวกันและเท่ากับทั้งช่วงพอดี ซึ่งกลบสิ่งที่เทสต์นี้ต้องการจับ
     */
    const boomThenBust = series([
      ...Array.from({ length: 18 }, () => 0.06),
      ...Array.from({ length: 18 }, () => -0.03),
    ])
    const stats = rollingStats(boomThenBust, 12)
    const wholePeriod = cagr(boomThenBust)!

    expect(stats.average).not.toBeCloseTo(wholePeriod, 4)
    // และช่วงของหน้าต่างกว้างจริง ไม่ใช่ค่าเดียวกันทุกชุด
    expect(stats.max! - stats.min!).toBeGreaterThan(0.01)
  })

  test("สัดส่วนที่เป็นบวกนับเฉพาะที่มากกว่าศูนย์จริง", () => {
    // 13 หน้าต่างจากชุด 24 เดือน — ครึ่งแรกบวก ครึ่งหลังลบ
    const mixed = series([...Array.from({ length: 12 }, () => 0.02), ...Array.from({ length: 12 }, () => -0.02)])
    const stats = rollingStats(mixed, 12)

    expect(stats.count).toBe(13)
    expect(stats.positiveShare).toBeGreaterThan(0)
    expect(stats.positiveShare).toBeLessThan(1)
  })

  test("หน้าต่างที่ไม่ถูกต้องไม่ทำให้ระเบิด", () => {
    expect(rollingWindows(FLAT, 0)).toEqual([])
    expect(rollingWindows([], 12)).toEqual([])
    expect(rollingStats([], 12).count).toBe(0)
  })
})
