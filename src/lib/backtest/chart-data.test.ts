import { describe, expect, it } from "vitest"
import { endBalance, portfolioReturns } from "@/engine"
import type { MonthlyReturn } from "@/types/series"
import { buildAnnualData, buildDrawdownData, buildGrowthData } from "./chart-data"
import bnd from "@/data/fixtures/bnd.json"
import cpi from "@/data/fixtures/th-cpi.json"
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
  const data = buildGrowthData([portfolio], benchmark, 10_000)

  it("เริ่มที่จุดตั้งต้น 10,000 ทั้งสองเส้น และมีจุดครบทุกเดือน", () => {
    expect(data.points).toHaveLength(portfolio.length + 1)
    expect(data.points[0]).toEqual({ month: null, values: [10_000], p0: 10_000, benchmark: 10_000 })
  })

  it("จุดสุดท้ายตรงกับมูลค่าสุดท้ายจากชั้นคำนวณ (BR-GRW-07)", () => {
    const last = data.points[data.points.length - 1]
    expect(last.values[0]).toBeCloseTo(endBalance(portfolio, 10_000), 6)
    expect(last.benchmark).toBeCloseTo(endBalance(benchmark, 10_000), 6)
  })

  it("ตารางสิ้นปีครบ 15 ปี และปีสุดท้ายเท่ามูลค่าสุดท้าย", () => {
    expect(data.yearEnd).toHaveLength(15)
    expect(data.yearEnd[0].year).toBe(2012)
    expect(data.yearEnd[0].month).toBe("2012-12")
    const last = data.yearEnd[data.yearEnd.length - 1]
    expect(last.year).toBe(2026)
    expect(last.month).toBe("2026-06")
    expect(last.values[0]).toBeCloseTo(endBalance(portfolio, 10_000), 6)
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
    expect(buildGrowthData([wiped], [], 10_000).logDisabled).toBe(true)
  })

  it("ตัวเทียบว่าง → เส้นตัวเทียบเป็นไม่มีค่า ไม่ใช่ศูนย์", () => {
    const solo = buildGrowthData([portfolio.slice(0, 12)], [], 10_000)
    expect(solo.points[1].benchmark).toBeNull()
  })
})

describe("buildAnnualData (US-09)", () => {
  const { portfolio, benchmark } = referencePortfolio()
  const data = buildAnnualData([portfolio], benchmark)

  it("ครบทุกปี 2012 ถึง 2026", () => {
    expect(data.rows.map((r) => r.year)).toEqual(
      Array.from({ length: 15 }, (_, i) => 2012 + i),
    )
  })

  it("ค่าปีที่ดีที่สุด/แย่ที่สุดตรงชุดอ้างอิง (BR-ANN-05)", () => {
    const y2019 = data.rows.find((r) => r.year === 2019)!
    const y2022 = data.rows.find((r) => r.year === 2022)!
    expect(y2019.values[0]! * 100).toBeCloseTo(24.02, 1)
    expect(y2022.values[0]! * 100).toBeCloseTo(-17.95, 1)
  })

  it("ปีไม่เต็มติดจำนวนเดือนที่มีข้อมูล (BR-ANN-03)", () => {
    const y2026 = data.rows.find((r) => r.year === 2026)!
    expect(y2026.months[0]).toBe(6)
    const y2019 = data.rows.find((r) => r.year === 2019)!
    expect(y2019.months[0]).toBeUndefined()
  })

  it("ช่วงปีเดียวก็ยังมีแถวให้แสดง (EC ของการ์ด)", () => {
    const single = buildAnnualData([portfolio.slice(0, 6)], benchmark.slice(0, 6))
    expect(single.rows).toHaveLength(1)
    expect(single.rows[0].months[0]).toBe(6)
  })

  describe("ปรับเงินเฟ้อ (US-15)", () => {
    const real = buildAnnualData([portfolio], benchmark, { rates: cpi.rates, enabled: true })

    it("BR-INF-04 ปรับทั้งพอร์ตและตัวเทียบพร้อมกัน ด้วยสูตรหาร", () => {
      for (const year of [2019, 2022]) {
        const rate = cpi.rates.find((r) => r.year === year)!
        const before = data.rows.find((r) => r.year === year)!
        const after = real.rows.find((r) => r.year === year)!

        expect(after.values[0]).toBeCloseTo((1 + before.values[0]!) / (1 + rate.value) - 1, 12)
        expect(after.benchmark).toBeCloseTo((1 + before.benchmark!) / (1 + rate.value) - 1, 12)
      }
    })

    it("BR-INF-09 ปีที่ไม่มีดัชนีคงค่าเดิม", () => {
      expect(cpi.rates.some((r) => r.year === 2026)).toBe(false)
      expect(real.rows.find((r) => r.year === 2026)!.values[0]).toBe(
        data.rows.find((r) => r.year === 2026)!.values[0],
      )
    })

    it("EC-INF-01 ปีที่เงินเฟ้อติดลบ ค่าสูงขึ้น", () => {
      const before = data.rows.find((r) => r.year === 2020)!
      const after = real.rows.find((r) => r.year === 2020)!
      expect(after.values[0]!).toBeGreaterThan(before.values[0]!)
    })

    it("AC-INF-10 ปิดตัวเลือกแล้วได้แถวชุดเดิมทุกหลัก", () => {
      expect(buildAnnualData([portfolio], benchmark, { rates: cpi.rates, enabled: false })).toEqual(
        data,
      )
    })

    it("จำนวนเดือนของปีไม่เต็มยังติดมาเหมือนเดิม (BR-ANN-03)", () => {
      expect(real.rows.find((r) => r.year === 2026)!.months[0]).toBe(6)
    })
  })
})

describe("buildDrawdownData (US-10)", () => {
  const { portfolio, benchmark } = referencePortfolio()
  const data = buildDrawdownData([portfolio], benchmark)

  it("ห้าอันดับตรงกับตารางช่วงขาดทุนใน ROADMAP ภาคผนวก A", () => {
    // แถวที่ 2 ใช้ค่าที่ข้อมูล freeze ของเราให้ ตาม PD-007
    const expected = [
      { start: "2022-01", trough: "2022-09", depth: -23.55, recoveredAt: "2024-03", months: 18 },
      { start: "2020-01", trough: "2020-03", depth: -17.35, recoveredAt: "2020-07", months: 4 },
      { start: "2018-09", trough: "2018-12", depth: -10.18, recoveredAt: "2019-04", months: 4 },
      { start: "2015-06", trough: "2016-02", depth: -8.48, recoveredAt: "2016-07", months: 5 },
      { start: "2012-04", trough: "2012-05", depth: -6.23, recoveredAt: "2012-08", months: 3 },
    ]
    expect(data.perPortfolio[0].worst).toHaveLength(5)
    data.perPortfolio[0].worst.forEach((period, i) => {
      expect(period.start, `แถว ${i + 1} เดือนเริ่มตก`).toBe(expected[i].start)
      expect(period.trough, `แถว ${i + 1} เดือนต่ำสุด`).toBe(expected[i].trough)
      expect(period.depth * 100, `แถว ${i + 1} ความลึก`).toBeCloseTo(expected[i].depth, 1)
      expect(period.recoveredAt, `แถว ${i + 1} เดือนที่ฟื้น`).toBe(expected[i].recoveredAt)
      expect(period.recoveryMonths, `แถว ${i + 1} เวลาฟื้น`).toBe(expected[i].months)
    })
  })

  it("รายงานจำนวนช่วงทั้งหมดที่พบ มากกว่าห้าที่แสดง (BR-DDW-06)", () => {
    expect(data.perPortfolio[0].totalPeriods).toBeGreaterThan(5)
  })

  it("จุดลึกที่สุดของเส้นใต้น้ำตรงกับความลึกอันดับหนึ่ง", () => {
    const lowest = Math.min(...data.points.map((p) => p.values[0] ?? 0))
    expect(lowest).toBeCloseTo(data.perPortfolio[0].worst[0].depth, 6)
  })

  it("เส้นใต้น้ำมีจุดครบทุกเดือนและเริ่มที่ศูนย์หรือติดลบเสมอ", () => {
    expect(data.points).toHaveLength(portfolio.length)
    for (const point of data.points) expect(point.p0).toBeLessThanOrEqual(0)
  })

  it("พอร์ตที่ไม่เคยต่ำกว่าจุดสูงสุดเดิม ไม่มีช่วงขาดทุนเลย (AC-DDW-09)", () => {
    const upOnly: MonthlyReturn[] = [
      { month: "2020-01", value: 0.01 },
      { month: "2020-02", value: 0.02 },
      { month: "2020-03", value: 0.01 },
    ]
    const result = buildDrawdownData([upOnly], [])
    expect(result.perPortfolio[0].worst).toHaveLength(0)
    expect(result.perPortfolio[0].totalPeriods).toBe(0)
  })

  it("ช่วงที่ยังไม่ฟื้นจนจบข้อมูล รายงานเป็นไม่มีค่า ไม่ใช่ศูนย์ (BR-DDW-03)", () => {
    const downOnly: MonthlyReturn[] = [
      { month: "2020-01", value: 0.1 },
      { month: "2020-02", value: -0.2 },
      { month: "2020-03", value: -0.1 },
    ]
    const result = buildDrawdownData([downOnly], [])
    expect(result.perPortfolio[0].worst[0].recoveredAt).toBeNull()
    expect(result.perPortfolio[0].worst[0].recoveryMonths).toBeNull()
  })
})

describe("US-17 กราฟและตารางหลายพอร์ต", () => {
  const { portfolio, benchmark } = referencePortfolio()
  const allStocks = portfolioReturns([{ symbol: "VTI", weight: 100, returns: vti.returns }]).returns
  const two = [portfolio, allStocks]

  it("BR-CMP-25 กราฟมูลค่ามีเส้นครบทุกพอร์ต และพอร์ตแรกได้ค่าเท่ากับตอนรันเดี่ยว", () => {
    const solo = buildGrowthData([portfolio], benchmark, 10_000)
    const data = buildGrowthData(two, benchmark, 10_000)

    expect(data.points[0].values).toHaveLength(2)
    expect(data.points.map((p) => p.values[0])).toEqual(solo.points.map((p) => p.values[0]))
    expect(data.points[5].p1).toBe(data.points[5].values[1])
  })

  it("BR-CMP-32 สเกลลอการิทึมปิดเมื่อ**พอร์ตใดก็ตาม**แตะศูนย์ ไม่ใช่เฉพาะพอร์ตแรก", () => {
    const wiped: MonthlyReturn[] = [
      { month: "2020-01", value: 0.1 },
      { month: "2020-02", value: -1 },
    ]
    const healthy: MonthlyReturn[] = [
      { month: "2020-01", value: 0.01 },
      { month: "2020-02", value: 0.01 },
    ]

    expect(buildGrowthData([healthy], [], 10_000).logDisabled).toBe(false)
    expect(buildGrowthData([healthy, wiped], [], 10_000).logDisabled).toBe(true)
  })

  it("ตารางสิ้นปีมีค่าครบทุกพอร์ตในทุกแถว", () => {
    const data = buildGrowthData(two, benchmark, 10_000)
    for (const row of data.yearEnd) expect(row.values).toHaveLength(2)
  })

  it("BR-CMP-25 ตารางรายปีมีค่าครบทุกพอร์ต และพอร์ตแรกไม่ขยับ", () => {
    const solo = buildAnnualData([portfolio], benchmark)
    const data = buildAnnualData(two, benchmark)

    expect(data.rows.map((r) => r.year)).toEqual(solo.rows.map((r) => r.year))
    for (const row of data.rows) expect(row.values).toHaveLength(2)
    expect(data.rows.map((r) => r.values[0])).toEqual(solo.rows.map((r) => r.values[0]))
  })

  it("BR-CMP-30 ช่วงขาดทุนแยกหนึ่งชุดต่อพอร์ต เพราะช่วงของแต่ละพอร์ตไม่ตรงกัน", () => {
    const data = buildDrawdownData(two, benchmark)

    expect(data.perPortfolio).toHaveLength(2)
    // พอร์ตหุ้นล้วนขาดทุนลึกกว่าพอร์ตผสมในช่วงเดียวกัน
    expect(data.perPortfolio[1].worst[0].depth).toBeLessThan(data.perPortfolio[0].worst[0].depth)
    expect(data.points[0].values).toHaveLength(2)
  })

  it("พอร์ตแรกของทุกตัวได้ค่าเท่ากับตอนรันเดี่ยวทุกหลัก (BR-CMP-31)", () => {
    const soloDrawdown = buildDrawdownData([portfolio], benchmark)
    const data = buildDrawdownData(two, benchmark)

    expect(data.perPortfolio[0]).toEqual(soloDrawdown.perPortfolio[0])
  })
})
