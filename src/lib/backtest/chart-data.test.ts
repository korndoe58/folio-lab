import { describe, expect, it } from "vitest"
import { endBalance, portfolioReturns } from "@/engine"
import type { MonthlyReturn } from "@/types/series"
import { buildAnnualData, buildGrowthData } from "./chart-data"
import bnd from "@/data/fixtures/bnd.json"
import spy from "@/data/fixtures/spy.json"
import vnq from "@/data/fixtures/vnq.json"
import vti from "@/data/fixtures/vti.json"
import vxus from "@/data/fixtures/vxus.json"

/** พอร์ตอ้างอิงเดียวกับ golden test ของชั้นคำนวณ (ROADMAP ภาคผนวก A) */
function referencePortfolio(): { portfolio: MonthlyReturn[]; benchmark: MonthlyReturn[] } {
  const result = portfolioReturns([
    { symbol: "VTI", weight: 48, returns: vti.returns },
    { symbol: "VNQ", weight: 8, returns: vnq.returns },
    { symbol: "VXUS", weight: 24, returns: vxus.returns },
    { symbol: "BND", weight: 20, returns: bnd.returns },
  ])
  const range = result.usedRange!
  const benchmark = spy.returns.filter((r) => r.month >= range.start && r.month <= range.end)
  return { portfolio: result.returns, benchmark }
}

describe("buildGrowthData (US-08)", () => {
  const { portfolio, benchmark } = referencePortfolio()
  const data = buildGrowthData(portfolio, benchmark, 10_000)

  it("เริ่มที่จุดตั้งต้น 10,000 ทั้งสองเส้น และมีจุดครบทุกเดือน", () => {
    expect(data.points).toHaveLength(portfolio.length + 1)
    expect(data.points[0]).toEqual({ month: null, portfolio: 10_000, benchmark: 10_000 })
  })

  it("จุดสุดท้ายตรงกับมูลค่าสุดท้ายจากชั้นคำนวณ (BR-GRW-07)", () => {
    const last = data.points[data.points.length - 1]
    expect(last.portfolio).toBeCloseTo(endBalance(portfolio, 10_000), 6)
    expect(last.benchmark).toBeCloseTo(endBalance(benchmark, 10_000), 6)
  })

  it("ตารางสิ้นปีครบ 15 ปี และปีสุดท้ายเท่ามูลค่าสุดท้าย", () => {
    expect(data.yearEnd).toHaveLength(15)
    expect(data.yearEnd[0].year).toBe(2012)
    expect(data.yearEnd[0].month).toBe("2012-12")
    const last = data.yearEnd[data.yearEnd.length - 1]
    expect(last.year).toBe(2026)
    expect(last.month).toBe("2026-06")
    expect(last.portfolio).toBeCloseTo(endBalance(portfolio, 10_000), 6)
  })

  it("ป้ายปีถูกคัดไม่เกิน ~8 ตัว และเป็นเดือนมกราคมทั้งหมด", () => {
    expect(data.yearTicks.length).toBeGreaterThan(3)
    expect(data.yearTicks.length).toBeLessThanOrEqual(8)
    for (const tick of data.yearTicks) expect(tick.endsWith("-01")).toBe(true)
  })

  it("ข้อมูลอ้างอิงใช้สเกลลอการิทึมได้", () => {
    expect(data.logDisabled).toBe(false)
  })

  it("มูลค่าแตะศูนย์ → ปิดสเกลลอการิทึม (BR-GRW-08)", () => {
    const wiped: MonthlyReturn[] = [
      { month: "2020-01", value: 0.1 },
      { month: "2020-02", value: -1 },
      { month: "2020-03", value: 0.05 },
    ]
    expect(buildGrowthData(wiped, [], 10_000).logDisabled).toBe(true)
  })

  it("ตัวเทียบว่าง → เส้นตัวเทียบเป็นไม่มีค่า ไม่ใช่ศูนย์", () => {
    const solo = buildGrowthData(portfolio.slice(0, 12), [], 10_000)
    expect(solo.points[1].benchmark).toBeNull()
  })
})

describe("buildAnnualData (US-09)", () => {
  const { portfolio, benchmark } = referencePortfolio()
  const data = buildAnnualData(portfolio, benchmark)

  it("ครบทุกปี 2012 ถึง 2026", () => {
    expect(data.rows.map((r) => r.year)).toEqual(
      Array.from({ length: 15 }, (_, i) => 2012 + i),
    )
  })

  it("ค่าปีที่ดีที่สุด/แย่ที่สุดตรงชุดอ้างอิง (BR-ANN-05)", () => {
    const y2019 = data.rows.find((r) => r.year === 2019)!
    const y2022 = data.rows.find((r) => r.year === 2022)!
    expect(y2019.portfolio! * 100).toBeCloseTo(24.02, 1)
    expect(y2022.portfolio! * 100).toBeCloseTo(-17.95, 1)
  })

  it("ปีไม่เต็มติดจำนวนเดือนที่มีข้อมูล (BR-ANN-03)", () => {
    const y2026 = data.rows.find((r) => r.year === 2026)!
    expect(y2026.portfolioMonths).toBe(6)
    const y2019 = data.rows.find((r) => r.year === 2019)!
    expect(y2019.portfolioMonths).toBeUndefined()
  })

  it("ช่วงปีเดียวก็ยังมีแถวให้แสดง (EC ของการ์ด)", () => {
    const single = buildAnnualData(portfolio.slice(0, 6), benchmark.slice(0, 6))
    expect(single.rows).toHaveLength(1)
    expect(single.rows[0].portfolioMonths).toBe(6)
  })
})
