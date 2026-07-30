import { describe, expect, it } from "vitest"
import type { MonthlyReturn } from "@/types/series"
import { convertReturns, currencyOf, needsFx } from "./currency"

describe("currencyOf (BR-FX-01)", () => {
  it("สัญลักษณ์ที่ลงท้ายด้วยตลาดไทยเป็นเงินบาท", () => {
    expect(currencyOf("PTT.BK")).toBe("THB")
    expect(currencyOf("CPALL.BK")).toBe("THB")
    expect(currencyOf("ptt.bk")).toBe("THB")
    expect(currencyOf("  PTT.BK  ")).toBe("THB")
  })

  it("สัญลักษณ์อื่นถือเป็นดอลลาร์", () => {
    expect(currencyOf("VTI")).toBe("USD")
    expect(currencyOf("BRK-B")).toBe("USD")
    expect(currencyOf("BTC-USD")).toBe("USD")
  })
})

describe("needsFx (BR-FX-06)", () => {
  it("ทุกตัวเป็นสกุลเดียวกับฐาน → ไม่ต้องใช้อัตราแลกเปลี่ยน", () => {
    expect(needsFx(["VTI", "BND", "SPY"], "USD")).toBe(false)
    expect(needsFx(["PTT.BK", "CPALL.BK"], "THB")).toBe(false)
  })

  it("มีตัวไหนสกุลไม่ตรงฐาน → ต้องใช้", () => {
    expect(needsFx(["PTT.BK", "VTI"], "USD")).toBe(true)
    expect(needsFx(["VTI"], "THB")).toBe(true)
  })
})

describe("convertReturns — ทิศทางการแปลง (BR-FX-03, BR-FX-04)", () => {
  const asset: MonthlyReturn[] = [{ month: "2020-01", value: 0.1 }]
  /** เดือนนั้นบาทต่อดอลลาร์เพิ่ม 5% = เงินบาทอ่อนค่า */
  const fx: MonthlyReturn[] = [{ month: "2020-01", value: 0.05 }]

  it("AC-FX-01 สินทรัพย์ดอลลาร์มองเป็นเงินบาท ได้ 15.5% ไม่ใช่ 15%", () => {
    const [result] = convertReturns(asset, fx, "USD", "THB")
    // 1.10 × 1.05 − 1 = 0.155
    expect(result.value).toBeCloseTo(0.155, 10)
    expect(result.value).not.toBeCloseTo(0.15, 5)
  })

  it("AC-FX-02 สินทรัพย์เงินบาทมองเป็นดอลลาร์ ได้ 4.76%", () => {
    const [result] = convertReturns(asset, fx, "THB", "USD")
    // 1.10 ÷ 1.05 − 1 ≈ 0.047619
    expect(result.value).toBeCloseTo(0.047619, 6)
  })

  it("แปลงไปแล้วแปลงกลับได้ค่าเดิม (ทิศทางสองทางสอดคล้องกัน)", () => {
    const toThb = convertReturns(asset, fx, "USD", "THB")
    const backToUsd = convertReturns(toThb, fx, "THB", "USD")
    expect(backToUsd[0].value).toBeCloseTo(asset[0].value, 10)
  })
})

describe("convertReturns — กรณีที่ต้องไม่แตะข้อมูล (BR-FX-05)", () => {
  const asset: MonthlyReturn[] = [
    { month: "2020-01", value: 0.1 },
    { month: "2020-02", value: -0.02 },
  ]

  it("สกุลเดิมตรงกับสกุลฐาน คืนชุดเดิมทุกค่า", () => {
    expect(convertReturns(asset, [], "USD", "USD")).toEqual(asset)
    expect(convertReturns(asset, [], "THB", "THB")).toEqual(asset)
  })

  it("คืนตัวอ้างอิงเดิม จึงมั่นใจได้ว่าไม่มีการคำนวณซ้ำ", () => {
    expect(convertReturns(asset, [], "USD", "USD")).toBe(asset)
  })
})

describe("convertReturns — ข้อมูลไม่ครบหรือเสีย (BR-FX-09, EC-FX-02)", () => {
  const asset: MonthlyReturn[] = [
    { month: "2020-01", value: 0.1 },
    { month: "2020-02", value: 0.1 },
    { month: "2020-03", value: 0.1 },
  ]

  it("เดือนที่ไม่มีอัตราแลกเปลี่ยนถูกตัดออก ไม่ใช่คิดเป็นศูนย์", () => {
    const fx: MonthlyReturn[] = [
      { month: "2020-01", value: 0.05 },
      { month: "2020-03", value: 0.05 },
    ]
    const result = convertReturns(asset, fx, "USD", "THB")
    expect(result.map((r) => r.month)).toEqual(["2020-01", "2020-03"])
  })

  it("อัตราแลกเปลี่ยนที่ทำให้หารด้วยศูนย์ ถูกตัดออกแทนที่จะคืนค่าอนันต์", () => {
    const fx: MonthlyReturn[] = [
      { month: "2020-01", value: -1 },
      { month: "2020-02", value: 0.05 },
      { month: "2020-03", value: 0.05 },
    ]
    const result = convertReturns(asset, fx, "THB", "USD")
    expect(result.map((r) => r.month)).toEqual(["2020-02", "2020-03"])
    for (const item of result) expect(Number.isFinite(item.value)).toBe(true)
  })

  it("ไม่มีอัตราแลกเปลี่ยนเลย → ไม่เหลือเดือนไหนให้คำนวณ", () => {
    expect(convertReturns(asset, [], "USD", "THB")).toEqual([])
  })
})

describe("convertReturns — ความคงที่ของผล (AC-FX-09)", () => {
  it("แปลงชุดเดิมซ้ำได้ผลเท่าเดิมทุกค่า", () => {
    const asset: MonthlyReturn[] = [
      { month: "2020-01", value: 0.031 },
      { month: "2020-02", value: -0.017 },
    ]
    const fx: MonthlyReturn[] = [
      { month: "2020-01", value: 0.012 },
      { month: "2020-02", value: -0.004 },
    ]
    expect(convertReturns(asset, fx, "USD", "THB")).toEqual(convertReturns(asset, fx, "USD", "THB"))
  })
})
