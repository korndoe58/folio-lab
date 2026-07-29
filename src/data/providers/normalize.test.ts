import { describe, expect, test } from "vitest"
import { normalizeToMonthlyReturns } from "./normalize"
import type { DailyRow } from "./raw-source"

const row = (date: string, adjustedClose: number): DailyRow => ({ date, adjustedClose })

describe("US-02 แปลงราคารายวันเป็นผลตอบแทนรายเดือน", () => {
  test("AC-NRM-01 ใช้ราคาวันสุดท้ายของเดือน และเดือนแรกไม่มีผลตอบแทน", () => {
    const result = normalizeToMonthlyReturns(
      [row("2024-01-30", 99), row("2024-01-31", 100), row("2024-02-27", 99), row("2024-02-28", 110)],
      "2024-02",
    )

    expect(result.returns).toEqual([{ month: "2024-02", value: expect.closeTo(0.1, 10) }])
    expect(result.actualRange).toEqual({ start: "2024-02", end: "2024-02" })
  })

  test("AC-NRM-02 วันสุดท้ายของเดือนเป็นวันหยุด ใช้วันทำการสุดท้ายที่มีข้อมูล", () => {
    const result = normalizeToMonthlyReturns(
      [row("2024-03-28", 100), row("2024-04-29", 105)],
      "2024-04",
    )

    expect(result.returns).toEqual([{ month: "2024-04", value: expect.closeTo(0.05, 10) }])
  })

  test("AC-NRM-03 ผลตอบแทนคิดจากอัตราส่วน เก็บเป็นสัดส่วนไม่ใช่เปอร์เซ็นต์", () => {
    const result = normalizeToMonthlyReturns(
      [row("2024-01-31", 99.51), row("2024-02-29", 101.0)],
      "2024-02",
    )

    expect(result.returns[0].value).toBeCloseTo(0.01497, 5)
  })

  test("AC-NRM-04 + AC-NRM-08 สเกลราคาเปลี่ยนทั้งชุด ผลตอบแทนต้องเท่าเดิม", () => {
    const rows = [row("2024-01-31", 100), row("2024-02-29", 103), row("2024-03-29", 101)]
    const rescaled = rows.map((r) => row(r.date, r.adjustedClose * 0.87654))

    const original = normalizeToMonthlyReturns(rows, "2024-03")
    const afterDividendRescale = normalizeToMonthlyReturns(rescaled, "2024-03")

    expect(afterDividendRescale.returns).toHaveLength(original.returns.length)
    original.returns.forEach((expected, i) => {
      expect(afterDividendRescale.returns[i].month).toBe(expected.month)
      expect(afterDividendRescale.returns[i].value).toBeCloseTo(expected.value, 12)
    })
  })

  test("AC-NRM-05 เดือนที่ยังไม่ปิดไม่เข้าผลลัพธ์", () => {
    const result = normalizeToMonthlyReturns(
      [row("2026-04-30", 100), row("2026-05-29", 110), row("2026-06-15", 200)],
      "2026-05",
    )

    expect(result.returns.map((r) => r.month)).toEqual(["2026-05"])
  })

  test("AC-NRM-06 เดือนขาดกลางชุด ตัดที่จุดต่อเนื่องและรายงาน", () => {
    const result = normalizeToMonthlyReturns(
      [
        row("2015-01-30", 100),
        row("2015-02-27", 102),
        // มีนาคม 2015 ขาดทั้งเดือน
        row("2015-04-30", 108),
        row("2015-05-29", 110),
      ],
      "2015-05",
    )

    expect(result.returns.map((r) => r.month)).toEqual(["2015-02"])
    expect(result.continuousThrough).toBe("2015-02")
    expect(result.truncated).toBe(true)
  })

  test("AC-NRM-07 ราคาปรับแล้วต่อเนื่องผ่านการแตกพาร์ ผลตอบแทนสะท้อนการเปลี่ยนแปลงจริง", () => {
    // ราคาปรับแล้วไม่กระโดดลงครึ่งหนึ่งตอนแตกพาร์
    const result = normalizeToMonthlyReturns(
      [row("2024-05-31", 200), row("2024-06-28", 204)],
      "2024-06",
    )

    expect(result.returns[0].value).toBeCloseTo(0.02, 10)
  })

  test("EC-NRM-01 ข้อมูลเดือนเดียวคำนวณผลตอบแทนไม่ได้", () => {
    const result = normalizeToMonthlyReturns([row("2024-01-31", 100)], "2024-01")

    expect(result.returns).toEqual([])
    expect(result.actualRange).toBeNull()
  })

  test("EC-NRM-02 สองเดือนติดกันได้ผลตอบแทนหนึ่งค่า", () => {
    const result = normalizeToMonthlyReturns(
      [row("2024-01-31", 100), row("2024-02-29", 101)],
      "2024-02",
    )

    expect(result.returns).toHaveLength(1)
  })

  test("EC-NRM-03 ราคาฐานเป็นศูนย์ถือว่าข้อมูลเสีย ไม่หารด้วยศูนย์", () => {
    const result = normalizeToMonthlyReturns(
      [row("2024-01-31", 100), row("2024-02-29", 0), row("2024-03-29", 50)],
      "2024-03",
    )

    expect(result.returns.map((r) => r.month)).toEqual(["2024-02"])
    expect(result.truncated).toBe(true)
    expect(result.returns.every((r) => Number.isFinite(r.value))).toBe(true)
  })

  test("EC-NRM-05 วันซ้ำและเรียงสลับ ใช้ค่าของวันหลังสุดเสมอ", () => {
    const shuffled = normalizeToMonthlyReturns(
      [
        row("2024-02-29", 110),
        row("2024-01-31", 100),
        row("2024-02-29", 120), // ค่าซ้ำของวันเดียวกัน ใช้ตัวหลัง
        row("2024-01-15", 90),
      ],
      "2024-02",
    )

    expect(shuffled.returns).toEqual([{ month: "2024-02", value: expect.closeTo(0.2, 10) }])
  })

  test("แถวที่วันที่ผิดรูปแบบหรือราคาไม่ใช่ตัวเลขถูกข้าม", () => {
    const result = normalizeToMonthlyReturns(
      [
        row("2024-01-31", 100),
        row("not-a-date", 999),
        { date: "2024-02-15", adjustedClose: Number.NaN },
        row("2024-02-29", 105),
      ],
      "2024-02",
    )

    expect(result.returns).toEqual([{ month: "2024-02", value: expect.closeTo(0.05, 10) }])
  })
})
