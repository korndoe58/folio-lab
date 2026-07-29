import { describe, expect, test } from "vitest"
import bnd from "@/data/fixtures/bnd.json"
import rf from "@/data/fixtures/rf.json"
import spy from "@/data/fixtures/spy.json"
import uponly from "@/data/fixtures/uponly.json"
import vnq from "@/data/fixtures/vnq.json"
import vti from "@/data/fixtures/vti.json"
import vxus from "@/data/fixtures/vxus.json"
import { portfolioReturns } from "@/engine"
import type { MonthlyReturn } from "@/types/series"
import { formatMoney, formatPercent, formatRatio, NO_VALUE } from "./format"
import { assembleSummary, type SummaryRow } from "./summary"

const REFERENCE = portfolioReturns([
  { symbol: "VTI", weight: 48, returns: vti.returns },
  { symbol: "VNQ", weight: 8, returns: vnq.returns },
  { symbol: "VXUS", weight: 24, returns: vxus.returns },
  { symbol: "BND", weight: 20, returns: bnd.returns },
]).returns

const BENCHMARK = portfolioReturns([{ symbol: "SPY", weight: 100, returns: spy.returns }]).returns

const summary = assembleSummary({
  portfolio: REFERENCE,
  benchmark: BENCHMARK,
  riskFree: rf.returns as MonthlyReturn[],
  amount: 10_000,
})

const find = (metric: string): SummaryRow => {
  const row = summary.rows.find((r) => r.metric === metric)
  if (!row) throw new Error(`ไม่พบแถว ${metric}`)
  return row
}

const shown = (row: SummaryRow, column: "portfolio" | "benchmark") => {
  const value = row[column]
  if (row.format === "money") return formatMoney(value)
  if (row.format === "percent") return formatPercent(value)
  return formatRatio(value)
}

describe("US-07 ค่าที่จะขึ้นบนตารางสรุป", () => {
  test("BR-SUM-02 มี 9 แถวเรียงตามลำดับที่การ์ดกำหนด", () => {
    expect(summary.rows.map((r) => r.metric)).toEqual([
      "startAmount",
      "endBalance",
      "cagr",
      "stdev",
      "bestYear",
      "worstYear",
      "maxDrawdown",
      "sharpe",
      "sortino",
    ])
  })

  test("AC-SUM-01 ค่าของพอร์ตตรงกับที่ชุดทดสอบของชั้นคำนวณยืนยันไว้", () => {
    expect(shown(find("endBalance"), "portfolio")).toBe("$41,495")
    expect(shown(find("cagr"), "portfolio")).toBe("10.31%")
    expect(shown(find("stdev"), "portfolio")).toBe("11.42%")
    expect(shown(find("maxDrawdown"), "portfolio")).toBe("-23.55%")
    expect(shown(find("sharpe"), "portfolio")).toBe("0.78")
    expect(shown(find("sortino"), "portfolio")).toBe("1.19")
  })

  test("AC-SUM-02 คอลัมน์ตัวเทียบมีค่าครบทุกแถว", () => {
    expect(shown(find("endBalance"), "benchmark")).toBe("$76,589")
    expect(shown(find("cagr"), "benchmark")).toBe("15.07%")
    expect(shown(find("stdev"), "benchmark")).toBe("14.04%")
    expect(shown(find("maxDrawdown"), "benchmark")).toBe("-23.93%")
    expect(shown(find("sharpe"), "benchmark")).toBe("0.96")
    expect(shown(find("sortino"), "benchmark")).toBe("1.55")

    for (const row of summary.rows) {
      expect(row.benchmark, `แถว ${row.metric} ต้องมีค่าของตัวเทียบ`).not.toBeNull()
    }
  })

  test("AC-SUM-04 ปีที่ดีที่สุดและแย่ที่สุดพร้อมปีกำกับ (เฉพาะปีเต็ม)", () => {
    const best = find("bestYear")
    expect(best.portfolioYear).toBe(2019)
    expect(shown(best, "portfolio")).toBe("24.02%")

    const worst = find("worstYear")
    expect(worst.portfolioYear).toBe(2022)
    expect(shown(worst, "portfolio")).toBe("-17.95%")
  })

  test("BR-SUM-07 ทิศเทียบตัวเทียบถูกต้องต่อแถว", () => {
    // พอร์ตให้ผลตอบแทนน้อยกว่าตลาดในช่วงนี้
    expect(find("cagr").comparison).toBe("worse")
    // แต่ผันผวนน้อยกว่าและขาดทุนตื้นกว่า จึงถือว่าดีกว่าในสองแถวนั้น
    expect(find("stdev").comparison).toBe("better")
    expect(find("maxDrawdown").comparison).toBe("better")
    // เงินตั้งต้นเท่ากันไม่ต้องเทียบ
    expect(find("startAmount").comparison).toBeNull()
  })

  test("จำนวนเดือนตรงกับช่วงที่ใช้จริง", () => {
    expect(summary.months).toBe(174)
  })
})

describe("US-07 ค่าที่คำนวณไม่ได้", () => {
  const upOnly = portfolioReturns([{ symbol: "UPONLY", weight: 100, returns: uponly.returns }]).returns
  const noDownside = assembleSummary({
    portfolio: upOnly,
    benchmark: BENCHMARK,
    riskFree: rf.returns as MonthlyReturn[],
    amount: 10_000,
  })

  test("AC-SUM-05 พอร์ตที่ไม่มีเดือนติดลบ Sortino ไม่มีค่าและมีเหตุผลกำกับ", () => {
    const row = noDownside.rows.find((r) => r.metric === "sortino")!

    expect(row.portfolio).toBeNull()
    expect(row.unavailableReason).toBe("summary.noDownside")
    expect(formatRatio(row.portfolio)).toBe(NO_VALUE)
    expect(row.comparison, "เทียบไม่ได้เมื่อค่าหนึ่งไม่มี").toBeNull()
  })

  test("ค่าที่ไม่มีต้องไม่ถูกแสดงเป็นศูนย์", () => {
    expect(formatMoney(null)).toBe(NO_VALUE)
    expect(formatPercent(null)).toBe(NO_VALUE)
    expect(formatRatio(null)).toBe(NO_VALUE)
  })
})

describe("BR-MVP-04 รูปแบบตัวเลข", () => {
  test("จำนวนเงินเป็นจำนวนเต็ม คั่นหลักพัน พร้อมสกุลดอลลาร์", () => {
    expect(formatMoney(41_515.37)).toBe("$41,515")
    expect(formatMoney(1_234_567)).toBe("$1,234,567")
    expect(formatMoney(0)).toBe("$0")
  })

  test("เปอร์เซ็นต์สองตำแหน่ง รวมค่าติดลบ", () => {
    expect(formatPercent(0.1032)).toBe("10.32%")
    expect(formatPercent(-0.2355)).toBe("-23.55%")
    expect(formatPercent(0)).toBe("0.00%")
  })

  test("อัตราส่วนสองตำแหน่ง", () => {
    expect(formatRatio(0.78)).toBe("0.78")
    expect(formatRatio(-0.5)).toBe("-0.50")
  })
})
