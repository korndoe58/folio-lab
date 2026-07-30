import { describe, expect, it } from "vitest"
import { DEMO_PORTFOLIOS, demoPortfolioHref, demoPortfolioMix } from "./demo-portfolios"
import { decodeConfig } from "./url"
import { hasIssues, validateConfig } from "./validation"

const LAST_CLOSED_YEAR = 2026

describe("พอร์ตตัวอย่างหน้าแรก (US-11)", () => {
  it("มีสี่ชุด โดยชุดสุดท้ายเป็นพอร์ตที่มีหุ้นไทย (BR-SET-04)", () => {
    expect(DEMO_PORTFOLIOS.map((p) => p.key)).toEqual([
      "balanced",
      "allUsStocks",
      "global",
      "thaiAndWorld",
    ])
  })

  it("ชุดที่มีหุ้นไทยใช้ฐานเงินบาท ส่วนชุดสินทรัพย์ต่างประเทศใช้ฐานดอลลาร์ (BR-SET-05)", () => {
    const byKey = Object.fromEntries(DEMO_PORTFOLIOS.map((p) => [p.key, p.config]))
    expect(byKey.thaiAndWorld.baseCurrency).toBe("THB")
    for (const key of ["balanced", "allUsStocks", "global"]) {
      expect(byKey[key].baseCurrency, `ชุด ${key} ต้องได้ผลเท่าเดิมทุกหลัก`).toBe("USD")
    }
  })

  it.each(DEMO_PORTFOLIOS)("ชุด $key ผ่านการตรวจของฟอร์มโดยไม่มีข้อผิดพลาด", (portfolio) => {
    const issues = validateConfig(portfolio.config, {
      lastClosedYear: LAST_CLOSED_YEAR,
      unknownSymbols: new Set(),
    })
    expect(hasIssues(issues), `ชุด ${portfolio.key} ต้องไม่ทำให้ผู้ใช้เจอข้อความแจ้งเตือน`).toBe(false)
  })

  it.each(DEMO_PORTFOLIOS)("ชุด $key มีค่าครบทุกช่องตาม BR-DMO-04", (portfolio) => {
    const { config } = portfolio
    expect(config.portfolios[0].assets.length).toBeGreaterThan(0)
    expect(config.startYear).toBe(2015)
    expect(config.endYear).toBe(2025)
    expect(config.amount).toBeGreaterThan(0)
    expect(config.benchmark).toBe("SPY")

    const total = config.portfolios[0].assets.reduce((sum, a) => sum + Number(a.weight), 0)
    expect(total).toBe(100)
  })

  it.each(DEMO_PORTFOLIOS)("ลิงก์ของชุด $key ถอดกลับได้ค่าเดิมครบ", (portfolio) => {
    const href = demoPortfolioHref(portfolio)
    expect(href.startsWith("/backtest?")).toBe(true)

    const params = new URLSearchParams(href.split("?")[1])
    const decoded = decodeConfig(params, LAST_CLOSED_YEAR)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return

    expect(decoded.config.portfolios[0].assets).toEqual(portfolio.config.portfolios[0].assets)
    expect(decoded.config.startYear).toBe(portfolio.config.startYear)
    expect(decoded.config.endYear).toBe(portfolio.config.endYear)
    expect(decoded.config.amount).toBe(portfolio.config.amount)
    expect(decoded.config.benchmark).toBe(portfolio.config.benchmark)
  })

  it("ส่วนผสมที่แสดงบนการ์ดอ่านออกเป็นสัญลักษณ์และเปอร์เซ็นต์", () => {
    expect(demoPortfolioMix(DEMO_PORTFOLIOS[0])).toBe("VTI 60% · BND 40%")
    expect(demoPortfolioMix(DEMO_PORTFOLIOS[1])).toBe("VTI 100%")
  })
})
