import { describe, expect, test } from "vitest"
import type { BacktestConfig } from "@/types/backtest"
import { evenWeights, hasIssues, validateConfig, weightSum } from "./validation"

const LAST_CLOSED_YEAR = 2026

const config = (overrides: Partial<BacktestConfig> = {}): BacktestConfig => ({
  assets: [
    { symbol: "VTI", weight: "60" },
    { symbol: "BND", weight: "40" },
  ],
  startYear: 2015,
  endYear: 2025,
  amount: 10_000,
  benchmark: "SPY",
  ...overrides,
})

const check = (c: BacktestConfig, unknownSymbols?: Set<string>) =>
  validateConfig(c, { lastClosedYear: LAST_CLOSED_YEAR, unknownSymbols })

describe("US-05 การตรวจฟอร์ม", () => {
  test("AC-CFG-02 ฟอร์มที่ถูกต้องไม่มีข้อผิดพลาด", () => {
    expect(hasIssues(check(config()))).toBe(false)
  })

  test("AC-CFG-03 น้ำหนักรวมไม่เท่ากับ 100 แจ้ง V-001 พร้อมผลรวมจริง", () => {
    const issues = check(config({ assets: [
      { symbol: "VTI", weight: "60" },
      { symbol: "BND", weight: "30" },
    ] }))

    expect(issues.form).toEqual({ code: "V-001", params: { sum: "90" } })
  })

  test("AC-CFG-04 ยังไม่กรอกสัญลักษณ์เลย แจ้ง V-002", () => {
    const issues = check(config({ assets: [{ symbol: "", weight: "" }] }))
    expect(issues.form?.code).toBe("V-002")
  })

  test("AC-CFG-05 สัญลักษณ์ที่ไม่มีข้อมูล แจ้ง V-003 พร้อมชื่อ", () => {
    const issues = check(
      config({ assets: [{ symbol: "ZZZZZ", weight: "100" }] }),
      new Set(["ZZZZZ"]),
    )

    expect(issues.rows[0]).toEqual({ code: "V-003", params: { symbol: "ZZZZZ" } })
  })

  test("AC-CFG-06 ปีเริ่มต้นมากกว่าปีสิ้นสุด แจ้ง V-004", () => {
    expect(check(config({ startYear: 2020, endYear: 2015 })).endYear?.code).toBe("V-004")
  })

  test("ปีเริ่มต้นเท่ากับปีสิ้นสุดใช้ได้", () => {
    expect(check(config({ startYear: 2020, endYear: 2020 })).endYear).toBeNull()
  })

  test("AC-CFG-07 ปีสิ้นสุดเกินเดือนที่มีข้อมูล แจ้ง V-005", () => {
    expect(check(config({ endYear: 2030 })).endYear?.code).toBe("V-005")
  })

  test("AC-CFG-08 เงินตั้งต้นไม่ถูกต้อง แจ้ง V-006", () => {
    expect(check(config({ amount: 0 })).amount?.code).toBe("V-006")
    expect(check(config({ amount: -100 })).amount?.code).toBe("V-006")
    expect(check(config({ amount: 2_000_000_000 })).amount?.code).toBe("V-006")
    expect(check(config({ amount: 10_000 })).amount).toBeNull()
  })

  test("AC-CFG-09 + EC-CFG-03 น้ำหนักนอกช่วงหรือไม่ใช่ตัวเลข แจ้ง V-007", () => {
    const outOfRange = check(config({ assets: [{ symbol: "VTI", weight: "150" }] }))
    expect(outOfRange.rows[0]?.code).toBe("V-007")

    const notANumber = check(config({ assets: [{ symbol: "VTI", weight: "abc" }] }))
    expect(notANumber.rows[0]?.code).toBe("V-007")

    const blank = check(config({ assets: [{ symbol: "VTI", weight: "   " }] }))
    expect(blank.rows[0]?.code, "ช่องว่างล้วนต้องไม่ถือเป็นศูนย์เงียบ ๆ").toBe("V-007")
  })

  test("AC-CFG-10 สัญลักษณ์ซ้ำในพอร์ตเดียว แจ้ง V-010", () => {
    const issues = check(config({ assets: [
      { symbol: "VTI", weight: "50" },
      { symbol: "vti", weight: "50" },
    ] }))

    expect(issues.rows[1]?.code).toBe("V-010")
  })

  test("EC-CFG-01 น้ำหนักรวม 99.99 หรือ 100.01 ยังผ่านตามความคลาดที่ยอมรับ", () => {
    const three = check(config({ assets: [
      { symbol: "A", weight: "33.34" },
      { symbol: "B", weight: "33.33" },
      { symbol: "C", weight: "33.33" },
    ] }))
    expect(three.form).toBeNull()

    const under = check(config({ assets: [
      { symbol: "A", weight: "33.33" },
      { symbol: "B", weight: "33.33" },
      { symbol: "C", weight: "33.33" },
    ] }))
    expect(under.form).toBeNull()
  })

  test("EC-CFG-07 สัญลักษณ์ตัวพิมพ์เล็กใช้ได้", () => {
    expect(hasIssues(check(config({ assets: [{ symbol: "vti", weight: "100" }] })))).toBe(false)
  })

  test("สัญลักษณ์ผิดรูปแบบแจ้ง V-003", () => {
    expect(check(config({ assets: [{ symbol: "VT I", weight: "100" }] })).rows[0]?.code).toBe("V-003")
    expect(check(config({ assets: [{ symbol: "1ABC", weight: "100" }] })).rows[0]?.code).toBe("V-003")
  })

  test("ตัวเทียบที่ไม่มีข้อมูลแจ้ง V-003 ที่ช่องตัวเทียบ", () => {
    const issues = check(config({ benchmark: "NOPE" }), new Set(["NOPE"]))
    expect(issues.benchmark?.code).toBe("V-003")
  })

  test("แถวว่างที่ยังไม่กรอกไม่ถือว่าผิด", () => {
    const issues = check(config({ assets: [
      { symbol: "VTI", weight: "100" },
      { symbol: "", weight: "" },
    ] }))

    expect(issues.rows[1]).toBeNull()
    expect(issues.form).toBeNull()
  })
})

describe("US-05 ตัวช่วยของฟอร์ม", () => {
  test("AC-CFG-11 เฉลี่ยน้ำหนักเท่ากันแล้วรวมได้ 100 พอดี", () => {
    expect(evenWeights(3)).toEqual(["33.34", "33.33", "33.33"])
    expect(evenWeights(2)).toEqual(["50", "50"])
    expect(evenWeights(4)).toEqual(["25", "25", "25", "25"])

    for (const count of [1, 3, 6, 7, 9]) {
      const total = evenWeights(count).reduce((sum, w) => sum + Number(w), 0)
      expect(Math.abs(total - 100), `${count} แถวต้องรวมได้ 100`).toBeLessThanOrEqual(0.01)
    }
  })

  test("ผลรวมนับเฉพาะแถวที่กรอกสัญลักษณ์แล้ว", () => {
    expect(
      weightSum([
        { symbol: "VTI", weight: "60" },
        { symbol: "", weight: "999" },
      ]),
    ).toBe(60)
  })
})
