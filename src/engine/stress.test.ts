import { describe, expect, test } from "vitest"
import bnd from "@/data/fixtures/bnd.json"
import vnq from "@/data/fixtures/vnq.json"
import vti from "@/data/fixtures/vti.json"
import vxus from "@/data/fixtures/vxus.json"
import type { MonthlyReturn, YearMonth } from "@/types/series"
import { portfolioReturns } from "./portfolio"
import { STRESS_PERIODS, stressReturn, type StressPeriod } from "./stress"

/**
 * ผลตอบแทนช่วงวิกฤต (US-32)
 *
 * **สองในสี่ช่วงมีค่าอ้างอิงที่อิสระจากสูตรของเรา** — หน้าต่างของช่วงนั้นตรงกับช่วงขาดทุน
 * ที่ freeze ไว้พอดี ผลจึงต้องเท่ากันเป๊ะ · อีกสองช่วงเดือนเริ่มคลาดกันหนึ่งเดือนโดยตั้งใจ
 * ([PD-025](../../docs/product/decision-log.md)) จึงใช้ชุดคำนวณมือคุมกลไกทบต้นแทน
 */
const PCT_TOLERANCE = 0.1
const returnsOf = (fixture: { returns: MonthlyReturn[] }) => fixture.returns

const REFERENCE = portfolioReturns([
  { symbol: "VTI", weight: 48, returns: returnsOf(vti) },
  { symbol: "VNQ", weight: 8, returns: returnsOf(vnq) },
  { symbol: "VXUS", weight: 24, returns: returnsOf(vxus) },
  { symbol: "BND", weight: 20, returns: returnsOf(bnd) },
]).returns

const period = (key: string): StressPeriod => {
  const found = STRESS_PERIODS.find((item) => item.key === key)
  if (!found) throw new Error(`ไม่พบช่วง ${key}`)
  return found
}

function expectPercent(actual: number | null, expected: number, label: string) {
  expect(actual, `${label} ต้องมีค่า`).not.toBeNull()
  const actualPct = (actual as number) * 100
  expect(
    Math.abs(actualPct - expected),
    `${label}: คำนวณได้ ${actualPct.toFixed(2)}% เทียบอ้างอิง ${expected}%`,
  ).toBeLessThanOrEqual(PCT_TOLERANCE)
}

/** ชุดสังเคราะห์ที่ระบุเดือนเองได้ เพื่อคุมการครอบคลุมช่วง */
function at(months: Array<[YearMonth, number]>): MonthlyReturn[] {
  return months.map(([month, value]) => ({ month, value }))
}

describe("AC-RSK-33..34 ช่วงที่มีค่าอ้างอิงจากตารางช่วงขาดทุน", () => {
  test("★ ช่วงเงินเฟ้อ 2022 ต้องเท่ากับความลึกของช่วงขาดทุนอันดับหนึ่ง −23.55%", () => {
    // ม.ค.–ก.ย. 2022 เป็นเดือนชุดเดียวกับช่วงขาดทุนที่ freeze ไว้พอดี
    expectPercent(stressReturn(REFERENCE, period("inflation2022")), -23.55, "ช่วงเงินเฟ้อ 2022")
  })

  test("★ ช่วงตลาดจีนและน้ำมัน 2015–16 ต้องเท่ากับ −8.49%", () => {
    expectPercent(stressReturn(REFERENCE, period("china2015")), -8.49, "ช่วงจีนและน้ำมัน")
  })

  /**
   * ข้อนี้บันทึกไว้ว่า **อีกสองช่วงไม่ใช่ค่าอ้างอิง** และเพราะอะไร
   * ถ้าใครขยับหน้าต่างไปให้ตรงกับช่วงขาดทุนในอนาคต ข้อนี้จะแดงและบังคับให้อ่าน PD-025 ก่อน
   */
  test("อีกสองช่วงเดือนเริ่มคลาดกับช่วงขาดทุนหนึ่งเดือนโดยตั้งใจ (PD-025)", () => {
    expect(period("covid2020").start).toBe("2020-02") // ช่วงขาดทุนเริ่ม 2020-01
    expect(period("selloff2018").start).toBe("2018-10") // ช่วงขาดทุนเริ่ม 2018-09

    // จึงต้องไม่เท่ากับความลึกของช่วงขาดทุน — ถ้าเท่าแปลว่ามีคนขยับหน้าต่างแล้ว
    const covid = stressReturn(REFERENCE, period("covid2020")) as number
    expect(Math.abs(covid * 100 - -17.36)).toBeGreaterThan(PCT_TOLERANCE)
  })

  test("ทั้งสี่ช่วงมีค่าครบสำหรับพอร์ตอ้างอิง และติดลบทุกช่วง", () => {
    for (const item of STRESS_PERIODS) {
      const value = stressReturn(REFERENCE, item)
      expect(value, `ช่วง ${item.key}`).not.toBeNull()
      expect(value as number, `ช่วง ${item.key} ต้องเป็นช่วงที่ขาดทุน`).toBeLessThan(0)
    }
  })
})

describe("AC-RSK-35..38 ชุดคำนวณมือของกลไกทบต้น", () => {
  const twoMonths: StressPeriod = { key: "t", start: "2020-01", end: "2020-02" }

  test("−10% แล้ว −10% ได้ −19% ไม่ใช่ −20% (ทบต้น ไม่ใช่บวกกัน)", () => {
    const series = at([
      ["2020-01", -0.1],
      ["2020-02", -0.1],
    ])
    expectPercent(stressReturn(series, twoMonths), -19, "สองเดือนติดลบ")
  })

  test("+10% แล้ว −10% ได้ −1% — ขึ้นแล้วลงเท่ากันไม่กลับมาที่เดิม", () => {
    const series = at([
      ["2020-01", 0.1],
      ["2020-02", -0.1],
    ])
    expectPercent(stressReturn(series, twoMonths), -1, "ขึ้นแล้วลง")
  })

  test("ช่วงหนึ่งเดือนได้ผลตอบแทนของเดือนนั้นตรง ๆ", () => {
    const series = at([["2020-01", -0.075]])
    const oneMonth: StressPeriod = { key: "t", start: "2020-01", end: "2020-01" }
    expectPercent(stressReturn(series, oneMonth), -7.5, "ช่วงหนึ่งเดือน")
  })
})

describe("BR-RSK-46 ข้อมูลครอบคลุมไม่ครบต้องคืนไม่มีค่า", () => {
  const period3: StressPeriod = { key: "t", start: "2020-01", end: "2020-03" }

  test("ข้อมูลเริ่มหลังช่วงเริ่ม → ไม่มีค่า ไม่ใช่คำนวณจากที่มี", () => {
    const late = at([
      ["2020-02", -0.05],
      ["2020-03", -0.05],
    ])
    expect(stressReturn(late, period3)).toBeNull()
  })

  test("ข้อมูลจบก่อนช่วงจบ → ไม่มีค่า", () => {
    const early = at([
      ["2020-01", -0.05],
      ["2020-02", -0.05],
    ])
    expect(stressReturn(early, period3)).toBeNull()
  })

  test("ข้อมูลขาดเดือนกลางช่วง → ไม่มีค่า (นับจำนวนเดือน ไม่ใช่ดูแค่หัวท้าย)", () => {
    const gap = at([
      ["2020-01", -0.05],
      ["2020-03", -0.05],
    ])
    expect(stressReturn(gap, period3)).toBeNull()
  })

  test("ไม่มีข้อมูลในช่วงเลย → ไม่มีค่า", () => {
    expect(stressReturn(at([["2019-01", 0.02]]), period3)).toBeNull()
  })
})

describe("BR-RSK-48 ทุกช่วงอยู่ในกรอบข้อมูลที่มี", () => {
  test("ไม่มีช่วงไหนเริ่มก่อนปี 2012", () => {
    for (const item of STRESS_PERIODS) {
      expect(item.start >= "2012-01", `ช่วง ${item.key} เริ่ม ${item.start}`).toBe(true)
      expect(item.start <= item.end, `ช่วง ${item.key} เริ่มต้องไม่หลังจบ`).toBe(true)
    }
  })
})
