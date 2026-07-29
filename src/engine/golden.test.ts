import { describe, expect, test } from "vitest"
import bnd from "@/data/fixtures/bnd.json"
import rf from "@/data/fixtures/rf.json"
import spy from "@/data/fixtures/spy.json"
import vnq from "@/data/fixtures/vnq.json"
import vti from "@/data/fixtures/vti.json"
import vxus from "@/data/fixtures/vxus.json"
import type { MonthlyReturn } from "@/types/series"
import {
  annualReturns,
  annualizedStdev,
  bestWorstFullYears,
  cagr,
  drawdownPeriods,
  endBalance,
  portfolioReturns,
  sharpe,
  sortino,
} from "./index"

/**
 * ชุดทดสอบเทียบค่าอ้างอิงจาก Portfolio Visualizer (ROADMAP ภาคผนวก A)
 *
 * เกณฑ์ ±0.1% ตีความดังนี้:
 *   ค่าเปอร์เซ็นต์   → ±0.10 จุดเปอร์เซ็นต์
 *   ค่าเงิน          → ±0.1% เชิงสัมพัทธ์
 *   อัตราส่วนไร้หน่วย → ±0.01
 *   ชื่อเดือน        → ตรงเป๊ะ
 */
const PCT_TOLERANCE = 0.1
const RATIO_TOLERANCE = 0.01
const MONEY_RELATIVE = 0.001

const returnsOf = (fixture: { returns: MonthlyReturn[] }) => fixture.returns
const RF = returnsOf(rf)
const INITIAL = 10_000

function expectPercent(actual: number | null, expected: number, label: string) {
  expect(actual, `${label} ต้องมีค่า`).not.toBeNull()
  const actualPct = (actual as number) * 100
  expect(
    Math.abs(actualPct - expected),
    `${label}: คำนวณได้ ${actualPct.toFixed(2)}% เทียบอ้างอิง ${expected}%`,
  ).toBeLessThanOrEqual(PCT_TOLERANCE)
}

function expectRatio(actual: number | null, expected: number, label: string) {
  expect(actual, `${label} ต้องมีค่า`).not.toBeNull()
  expect(
    Math.abs((actual as number) - expected),
    `${label}: คำนวณได้ ${(actual as number).toFixed(3)} เทียบอ้างอิง ${expected}`,
  ).toBeLessThanOrEqual(RATIO_TOLERANCE)
}

function expectMoney(actual: number, expected: number, label: string) {
  expect(
    Math.abs(actual - expected) / expected,
    `${label}: คำนวณได้ ${Math.round(actual).toLocaleString()} เทียบอ้างอิง ${expected.toLocaleString()}`,
  ).toBeLessThanOrEqual(MONEY_RELATIVE)
}

const REFERENCE_PORTFOLIO = portfolioReturns([
  { symbol: "VTI", weight: 48, returns: returnsOf(vti) },
  { symbol: "VNQ", weight: 8, returns: returnsOf(vnq) },
  { symbol: "VXUS", weight: 24, returns: returnsOf(vxus) },
  { symbol: "BND", weight: 20, returns: returnsOf(bnd) },
])

const BENCHMARK = portfolioReturns([{ symbol: "SPY", weight: 100, returns: returnsOf(spy) }])

describe("AC-ENG-01..04 พอร์ตอ้างอิงเทียบ Portfolio Visualizer", () => {
  const returns = REFERENCE_PORTFOLIO.returns

  test("ช่วงที่ใช้คำนวณคือ ม.ค. 2012 ถึง มิ.ย. 2026 ครบ 174 เดือน", () => {
    expect(REFERENCE_PORTFOLIO.usedRange).toEqual({ start: "2012-01", end: "2026-06" })
    expect(returns).toHaveLength(174)
  })

  test("AC-ENG-01 มูลค่าสุดท้าย ผลตอบแทนต่อปี และความผันผวน", () => {
    expectMoney(endBalance(returns, INITIAL), 41_515, "มูลค่าสุดท้าย")
    expectPercent(cagr(returns), 10.32, "ผลตอบแทนต่อปีแบบทบต้น")
    expectPercent(annualizedStdev(returns), 11.43, "ความผันผวนต่อปี")
  })

  test("AC-ENG-02 ช่วงขาดทุนสูงสุด พร้อมเดือนและเวลาฟื้น", () => {
    const worst = drawdownPeriods(returns)[0]
    expectPercent(worst.depth, -23.55, "ช่วงขาดทุนสูงสุด")
    expect(worst.start).toBe("2022-01")
    expect(worst.trough).toBe("2022-09")
    expect(worst.lengthMonths).toBe(9)
    expect(worst.recoveredAt).toBe("2024-03")
    expect(worst.recoveryMonths).toBe(18)
  })

  test("AC-ENG-03 Sharpe และ Sortino", () => {
    expectRatio(sharpe(returns, RF), 0.78, "Sharpe")
    expectRatio(sortino(returns, RF), 1.18, "Sortino")
  })

  test("AC-ENG-04 ผลตอบแทนรายปี ปีที่ดีที่สุดและแย่ที่สุด", () => {
    const annual = annualReturns(returns)
    const { best, worst } = bestWorstFullYears(annual)

    expect(best?.year).toBe(2019)
    expectPercent(best?.value ?? null, 24.02, "ปีที่ดีที่สุด (2019)")
    expect(worst?.year).toBe(2022)
    expectPercent(worst?.value ?? null, -17.95, "ปีที่แย่ที่สุด (2022)")

    const y2026 = annual.find((a) => a.year === 2026)
    expect(y2026?.partial, "ปี 2026 ต้องถูกทำเครื่องหมายว่าเป็นปีไม่เต็ม").toBe(true)
    expect(y2026?.monthsCovered).toBe(6)
  })

  test("AC-ENG-11 ช่วงขาดทุนลึกสุด 5 อันดับ", () => {
    const expected = [
      { start: "2022-01", trough: "2022-09", depth: -23.55, recoveredAt: "2024-03", recoveryMonths: 18 },
      // PD-007: ต้นแบบระบุ ส.ค. 2020 แต่ข้อมูลที่เรา freeze ไว้ข้ามจุดสูงสุดเดิมตั้งแต่ ก.ค. 2020
      // (เกินไปเพียง 0.0034% — ระยะที่ข้อมูลต่างผู้ให้บริการพลิกผลได้) ยึดค่าจากข้อมูลของเราเอง
      { start: "2020-01", trough: "2020-03", depth: -17.36, recoveredAt: "2020-07", recoveryMonths: 4 },
      { start: "2018-09", trough: "2018-12", depth: -10.18, recoveredAt: "2019-04", recoveryMonths: 4 },
      { start: "2015-06", trough: "2016-02", depth: -8.49, recoveredAt: "2016-07", recoveryMonths: 5 },
      { start: "2012-04", trough: "2012-05", depth: -6.23, recoveredAt: "2012-08", recoveryMonths: 3 },
    ]
    const actual = drawdownPeriods(returns).slice(0, 5)

    expected.forEach((want, i) => {
      const got = actual[i]
      expect(got.start, `อันดับ ${i + 1} เดือนเริ่มตก`).toBe(want.start)
      expect(got.trough, `อันดับ ${i + 1} เดือนต่ำสุด`).toBe(want.trough)
      expectPercent(got.depth, want.depth, `อันดับ ${i + 1} ความลึก`)
      expect(got.recoveredAt, `อันดับ ${i + 1} เดือนที่ฟื้น`).toBe(want.recoveredAt)
      expect(got.recoveryMonths, `อันดับ ${i + 1} เวลาฟื้น`).toBe(want.recoveryMonths)
    })
  })
})

describe("ตัวเทียบ SPY เทียบ Portfolio Visualizer", () => {
  const returns = BENCHMARK.returns

  test("มูลค่าสุดท้าย ผลตอบแทนต่อปี และความผันผวน", () => {
    expect(returns).toHaveLength(174)
    expectMoney(endBalance(returns, INITIAL), 76_655, "มูลค่าสุดท้ายของตัวเทียบ")
    expectPercent(cagr(returns), 15.08, "ผลตอบแทนต่อปีของตัวเทียบ")
    expectPercent(annualizedStdev(returns), 14.03, "ความผันผวนต่อปีของตัวเทียบ")
  })

  test("ช่วงขาดทุนสูงสุด Sharpe และ Sortino ของตัวเทียบ", () => {
    expectPercent(drawdownPeriods(returns)[0].depth, -23.93, "ช่วงขาดทุนสูงสุดของตัวเทียบ")
    expectRatio(sharpe(returns, RF), 0.96, "Sharpe ของตัวเทียบ")
    expectRatio(sortino(returns, RF), 1.55, "Sortino ของตัวเทียบ")
  })

  test("ปีที่ดีที่สุดและแย่ที่สุดของตัวเทียบ", () => {
    const { best, worst } = bestWorstFullYears(annualReturns(returns))
    expectPercent(best?.value ?? null, 32.31, "ปีที่ดีที่สุดของตัวเทียบ")
    expectPercent(worst?.value ?? null, -18.17, "ปีที่แย่ที่สุดของตัวเทียบ")
  })
})
