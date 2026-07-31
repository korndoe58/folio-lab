import { describe, expect, test } from "vitest"
import bnd from "@/data/fixtures/bnd.json"
import vnq from "@/data/fixtures/vnq.json"
import vti from "@/data/fixtures/vti.json"
import vxus from "@/data/fixtures/vxus.json"
import type { MonthlyReturn } from "@/types/series"
import { portfolioReturns } from "./portfolio"
import {
  analyticalVaR,
  calmar,
  conditionalVaR,
  excessKurtosis,
  historicalVaR,
  skewness,
} from "./tail"

/**
 * ความเสี่ยงหางและรูปร่างการกระจาย (US-31)
 *
 * วิธีคิด VaR/CVaR ถูกยืนยันกับค่าอ้างอิงตั้งแต่ตอนเขียนการ์ด (S17) ว่า **มีวิธีเดียวที่ตรง**
 * ชุดนี้จึงล็อกวิธีนั้นไว้ — ถ้าใครเปลี่ยนไปใช้อันดับใกล้สุดหรือปัดลง จะแดงทันที
 *
 * Skewness กับ Kurtosis ไม่มีค่าอ้างอิง ใช้ชุดคำนวณมือที่การ์ดระบุ โดยชุด `[−1,−1,−1,−1,4]`
 * เป็น**ชุดเดียวที่แยกสูตรเชิงประชากรออกจากสูตรตัวอย่างได้**
 */
const PCT_TOLERANCE = 0.1

const returnsOf = (fixture: { returns: MonthlyReturn[] }) => fixture.returns

const REFERENCE = portfolioReturns([
  { symbol: "VTI", weight: 48, returns: returnsOf(vti) },
  { symbol: "VNQ", weight: 8, returns: returnsOf(vnq) },
  { symbol: "VXUS", weight: 24, returns: returnsOf(vxus) },
  { symbol: "BND", weight: 20, returns: returnsOf(bnd) },
]).returns

function expectPercent(actual: number | null, expected: number, label: string) {
  expect(actual, `${label} ต้องมีค่า`).not.toBeNull()
  const actualPct = (actual as number) * 100
  expect(
    Math.abs(actualPct - expected),
    `${label}: คำนวณได้ ${actualPct.toFixed(2)}% เทียบอ้างอิง ${expected}%`,
  ).toBeLessThanOrEqual(PCT_TOLERANCE)
}

/** ชุดสังเคราะห์จากรายการค่า */
function series(list: number[]): MonthlyReturn[] {
  return list.map((value, i) => ({
    month: `20${String(20 + Math.floor(i / 12)).padStart(2, "0")}-${String((i % 12) + 1).padStart(2, "0")}` as MonthlyReturn["month"],
    value,
  }))
}

describe("AC-RSK-09..12 VaR และ CVaR เทียบชุดอ้างอิง", () => {
  test("พอร์ตอ้างอิง 174 เดือน ได้ค่าตรงทั้งสามตัว", () => {
    expect(REFERENCE).toHaveLength(174)
    expectPercent(historicalVaR(REFERENCE), 5.24, "VaR 5% ในอดีต")
    expectPercent(analyticalVaR(REFERENCE), 4.55, "VaR 5% เชิงสถิติ")
    expectPercent(conditionalVaR(REFERENCE), 7.04, "CVaR 5%")
  })

  /**
   * ★ ข้อที่ค่าอ้างอิง **จับไม่ได้** — และเป็นเหตุผลที่ชุดสังเคราะห์ข้างล่างต้องมี
   *
   * บนพอร์ตอ้างอิง วิธีอันดับใกล้สุดให้ `5.2934%` ต่างจากวิธีที่ถูกแค่ `0.05` จุด
   * ซึ่ง**อยู่ในเกณฑ์ ±0.1 ที่ใช้เทียบต้นแบบ** — ค่าอ้างอิงจึงไม่ล็อกวิธีคิด
   * ส่วน CVaR ต่างกัน `0.22` จุด ค่าอ้างอิงจึงล็อกได้เอง
   */
  test("ค่าอ้างอิงล็อกวิธีของ CVaR ได้ แต่ล็อกวิธีของ VaR ในอดีตไม่ได้", () => {
    const conditional = conditionalVaR(REFERENCE) as number
    // ปัดลงเป็น 8 เดือนจะได้ 7.2566% ซึ่งหลุดเกณฑ์ → ชุดอ้างอิงจับได้เอง
    expect(Math.abs(conditional * 100 - 7.2566)).toBeGreaterThan(PCT_TOLERANCE)

    const historical = historicalVaR(REFERENCE) as number
    // แต่ของ VaR ในอดีตต่างกันไม่ถึงเกณฑ์ จึงต้องมีชุดสังเคราะห์คุมแยกต่างหาก
    expect(Math.abs(historical * 100 - 5.2934)).toBeLessThan(PCT_TOLERANCE)
  })

  test("★ ชุดสังเคราะห์ที่ล็อกวิธีคิด VaR ในอดีตไว้ตายตัว", () => {
    /**
     * 10 เดือน เดือนแย่สุด `−10%` เดือนถัดมา `0%`
     * - **ประมาณค่าเชิงเส้นบนอันดับ `p×(n−1)`** = อันดับ `0.45` → `−0.10 + 0.45 × 0.10 = −5.5%`
     * - อันดับใกล้สุด `ceil(0.05×10) = 1` → `−10%`
     *
     * ต่างกันเกือบสองเท่า — ชุดนี้จึงจับการเปลี่ยนวิธีได้แน่นอน ต่างจากพอร์ตอ้างอิง
     */
    const set = series([-0.1, 0, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01])
    expectPercent(historicalVaR(set), 5.5, "VaR ของชุดสังเคราะห์")
  })

  test("Calmar อนุมานจากค่าที่ยืนยันแล้ว = CAGR ÷ ค่าสัมบูรณ์ของ MaxDD", () => {
    const value = calmar(REFERENCE)
    expect(value).not.toBeNull()
    expect(Math.abs((value as number) - 0.4378)).toBeLessThanOrEqual(0.01)
  })
})

describe("AC-RSK-13..14 Skewness และ Kurtosis จากชุดคำนวณมือ", () => {
  test("[−1,−1,1,1] → ความเบ้ศูนย์ และความหนาของหางส่วนเกิน −2 พอดี", () => {
    const set = series([-1, -1, 1, 1])
    expect(skewness(set)).toBeCloseTo(0, 12)
    // ★ ค่าต่ำสุดที่เป็นไปได้ของ kurtosis ส่วนเกิน — จับได้ทันทีถ้าลืมลบ 3
    expect(excessKurtosis(set)).toBeCloseTo(-2, 12)
  })

  test("[−2,−1,1,2] → สมมาตรให้ความเบ้ศูนย์", () => {
    const set = series([-2, -1, 1, 2])
    expect(skewness(set)).toBeCloseTo(0, 12)
    expect(excessKurtosis(set)).toBeCloseTo(-1.64, 2)
  })

  test("★ [−1,−1,−1,−1,4] → ความเบ้ +1.5 (เชิงประชากร) ไม่ใช่ +2.236068 (ตัวอย่าง)", () => {
    const set = series([-1, -1, -1, -1, 4])
    // ชุดเดียวในชุดทดสอบทั้งหมดที่แยกสองสูตรนี้ออกจากกันได้
    expect(skewness(set)).toBeCloseTo(1.5, 10)
    expect(skewness(set)).not.toBeCloseTo(2.236068, 3)
    expect(excessKurtosis(set)).toBeCloseTo(0.25, 10)
  })

  test("[1,1,1,1,−4] → เครื่องหมายกลับด้านถูกต้อง", () => {
    const set = series([1, 1, 1, 1, -4])
    expect(skewness(set)).toBeCloseTo(-1.5, 10)
    expect(excessKurtosis(set)).toBeCloseTo(0.25, 10)
  })
})

describe("EC-RSK ค่าที่คำนวณไม่ได้คืนไม่มีค่า", () => {
  test("เดือนน้อยกว่า 2 → VaR ทุกแบบไม่มีค่า (BR-RSK-25)", () => {
    const one = series([0.01])
    expect(historicalVaR(one)).toBeNull()
    expect(analyticalVaR(one)).toBeNull()
    expect(conditionalVaR(one)).toBeNull()
  })

  test("เดือนน้อยกว่า 4 → ความเบ้และความหนาของหางไม่มีค่า (BR-RSK-26)", () => {
    const three = series([0.01, -0.02, 0.03])
    expect(skewness(three)).toBeNull()
    expect(excessKurtosis(three)).toBeNull()
  })

  test("ไม่เคยขาดทุนเลย → Calmar ไม่มีค่า ไม่ใช่อนันต์ (BR-RSK-23)", () => {
    const rising = series([0.01, 0.02, 0.01, 0.03])
    expect(calmar(rising)).toBeNull()
  })

  test("ผลตอบแทนเท่ากันทุกเดือน → รูปร่างการกระจายไม่มีค่า", () => {
    const flat = series([0.01, 0.01, 0.01, 0.01])
    expect(skewness(flat)).toBeNull()
    expect(excessKurtosis(flat)).toBeNull()
  })
})
