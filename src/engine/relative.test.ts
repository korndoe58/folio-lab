import { describe, expect, test } from "vitest"
import bnd from "@/data/fixtures/bnd.json"
import spy from "@/data/fixtures/spy.json"
import vnq from "@/data/fixtures/vnq.json"
import vti from "@/data/fixtures/vti.json"
import vxus from "@/data/fixtures/vxus.json"
import type { MonthlyReturn } from "@/types/series"
import { portfolioReturns } from "./portfolio"
import {
  alpha,
  beta,
  captureRatios,
  informationRatio,
  rSquared,
  trackingError,
} from "./relative"

/**
 * เมทริกที่เทียบกับตลาด (US-30)
 *
 * ห้าค่าแรกมีค่าอ้างอิงจากต้นแบบให้เทียบตรง ๆ (ROADMAP ภาคผนวก A) จึงตรวจตัวเองได้ทันที
 * ว่านิยามถูก · Tracking Error กับ Information Ratio ไม่มีค่าอ้างอิง จึงใช้ชุดคำนวณมือ
 * ตามที่การ์ดระบุ (BR-RSK-02, [PD-019](../../docs/product/decision-log.md))
 */
const PCT_TOLERANCE = 0.1
const RATIO_TOLERANCE = 0.01

const returnsOf = (fixture: { returns: MonthlyReturn[] }) => fixture.returns

const REFERENCE = portfolioReturns([
  { symbol: "VTI", weight: 48, returns: returnsOf(vti) },
  { symbol: "VNQ", weight: 8, returns: returnsOf(vnq) },
  { symbol: "VXUS", weight: 24, returns: returnsOf(vxus) },
  { symbol: "BND", weight: 20, returns: returnsOf(bnd) },
]).returns
const BENCHMARK = portfolioReturns([{ symbol: "SPY", weight: 100, returns: returnsOf(spy) }]).returns

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
    `${label}: คำนวณได้ ${(actual as number).toFixed(4)} เทียบอ้างอิง ${expected}`,
  ).toBeLessThanOrEqual(RATIO_TOLERANCE)
}

/** ชุดสังเคราะห์: ผลตอบแทนคงที่ทุกเดือนตามจำนวนที่กำหนด */
function flat(value: number, months = 12): MonthlyReturn[] {
  return Array.from({ length: months }, (_, i) => ({
    month: `20${String(20 + Math.floor(i / 12)).padStart(2, "0")}-${String((i % 12) + 1).padStart(2, "0")}` as MonthlyReturn["month"],
    value,
  }))
}

/** ชุดสังเคราะห์จากรายการค่า โดยเรียงเดือนต่อกัน */
function series(list: number[]): MonthlyReturn[] {
  return list.map((value, i) => ({
    month: `20${String(20 + Math.floor(i / 12)).padStart(2, "0")}-${String((i % 12) + 1).padStart(2, "0")}` as MonthlyReturn["month"],
    value,
  }))
}

describe("AC-RSK-01..05 ค่าที่เทียบกับต้นแบบได้", () => {
  test("Beta · Alpha · R² ตรงชุดอ้างอิง", () => {
    expectRatio(beta(REFERENCE, BENCHMARK), 0.79, "Beta")
    expectPercent(alpha(REFERENCE, BENCHMARK), -1.36, "Alpha")
    expectPercent(rSquared(REFERENCE, BENCHMARK), 93.11, "R²")
  })

  test("Upside และ Downside capture ตรงชุดอ้างอิง", () => {
    const capture = captureRatios(REFERENCE, BENCHMARK)
    expectPercent(capture.upside, 72.19, "Upside capture")
    expectPercent(capture.downside, 85.27, "Downside capture")
  })
})

describe("BR-RSK-18 ตัวเทียบเทียบกับตัวเอง — ข้อพิสูจน์ว่านิยามถูก", () => {
  test("Beta 1 · Alpha 0 · R² 100% · capture 100% ทั้งสองฝั่ง", () => {
    expectRatio(beta(BENCHMARK, BENCHMARK), 1, "Beta ของตัวเทียบกับตัวเอง")
    expectPercent(alpha(BENCHMARK, BENCHMARK), 0, "Alpha ของตัวเทียบกับตัวเอง")
    expectPercent(rSquared(BENCHMARK, BENCHMARK), 100, "R² ของตัวเทียบกับตัวเอง")

    const capture = captureRatios(BENCHMARK, BENCHMARK)
    expectPercent(capture.upside, 100, "Upside ของตัวเทียบกับตัวเอง")
    expectPercent(capture.downside, 100, "Downside ของตัวเทียบกับตัวเอง")
  })
})

describe("AC-RSK-06..08 Tracking Error และ Information Ratio จากชุดคำนวณมือ", () => {
  test("ชนะตัวเทียบคงที่ +1% ทุกเดือน → TE เป็นศูนย์ และ IR ไม่มีค่า", () => {
    const benchmark = flat(0.01)
    const portfolio = flat(0.02)

    expect(trackingError(portfolio, benchmark)).toBeCloseTo(0, 12)
    // ★ ตัวหารศูนย์ต้องคืนไม่มีค่า ไม่ใช่อนันต์ (BR-RSK-14, BR-RSK-03)
    expect(informationRatio(portfolio, benchmark)).toBeNull()
  })

  test("พอร์ตเท่าตัวเทียบทุกเดือน → ส่วนต่างศูนย์สนิท", () => {
    const benchmark = flat(0.01)
    expect(trackingError(benchmark, benchmark)).toBeCloseTo(0, 12)
    expect(informationRatio(benchmark, benchmark)).toBeNull()
  })

  test("ส่วนต่างสลับ +2%/−2% 12 เดือน → TE 7.24% และ IR ศูนย์", () => {
    const benchmark = flat(0, 12)
    const portfolio = series(Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? 0.02 : -0.02)))

    // sd ตัวอย่างของ ±0.02 คือ 0.0209 → × √12 = 7.24%
    expectPercent(trackingError(portfolio, benchmark), 7.24, "Tracking Error")
    // ค่าเฉลี่ยส่วนต่างเป็นศูนย์ แต่ TE ไม่ศูนย์ — สองตัวนี้วัดคนละอย่าง
    expect(informationRatio(portfolio, benchmark)).toBeCloseTo(0, 12)
  })
})

describe("EC-RSK ค่าที่คำนวณไม่ได้คืนไม่มีค่า", () => {
  test("ตัวเทียบที่ไม่ขยับเลย → Beta และ R² ไม่มีค่า", () => {
    const still = flat(0)
    const moving = series([0.01, -0.02, 0.03, 0.04])
    expect(beta(moving, still)).toBeNull()
    expect(rSquared(moving, still)).toBeNull()
  })

  test("ไม่มีเดือนที่ตัวเทียบเป็นบวกเลย → upside ไม่มีค่า (BR-RSK-16)", () => {
    const benchmark = flat(-0.01)
    const portfolio = flat(-0.005)
    const capture = captureRatios(portfolio, benchmark)
    expect(capture.upside).toBeNull()
    expect(capture.downside).not.toBeNull()
  })

  test("เดือนเดียวเทียบไม่ได้ → คืนไม่มีค่าแทนที่จะเดา", () => {
    const one = series([0.01])
    expect(beta(one, one)).toBeNull()
    expect(trackingError(one, one)).toBeNull()
  })
})
