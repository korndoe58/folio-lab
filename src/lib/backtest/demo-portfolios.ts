import type { BacktestConfig } from "@/types/backtest"
import { encodeConfig } from "./url"

export type DemoPortfolio = {
  /** คีย์ของชื่อและคำอธิบายใน i18n */
  key: string
  config: BacktestConfig
}

/**
 * พอร์ตตัวอย่างบนหน้าแรก (BR-DMO-02)
 *
 * ทุกชุดกำหนดค่าครบทุกช่องตาม BR-DMO-04 ไม่พึ่งค่าเริ่มต้นของฟอร์ม
 * และใช้ช่วงปี 2015–2025 ที่ทุกสัญลักษณ์ในชุดมีข้อมูลครบ เพื่อไม่ให้ผู้ใช้ครั้งแรก
 * เจอข้อความแจ้งว่าช่วงเวลาถูกย่อตั้งแต่จอแรก (BR-DMO-08)
 */
/**
 * สามชุดเดิมเป็นสินทรัพย์ดอลลาร์ล้วน จึงระบุฐานดอลลาร์ให้ค่าเท่าเดิมทุกหลัก
 * และไม่ปรับเงินเฟ้อ เพื่อให้จอแรกที่ผู้ใช้เห็นเทียบกับเครื่องมืออื่นได้ตรง ๆ (BR-INF-01)
 */
const SHARED = {
  startYear: 2015,
  endYear: 2025,
  amount: 10_000,
  benchmark: "SPY",
  baseCurrency: "USD",
  inflationAdjusted: false,
} as const

export const DEMO_PORTFOLIOS: DemoPortfolio[] = [
  {
    key: "balanced",
    config: {
      ...SHARED,
      portfolios: [
        {
          name: "",
          assets: [
            { symbol: "VTI", weight: "60" },
            { symbol: "BND", weight: "40" },
          ],
        },
      ],
    },
  },
  {
    key: "allUsStocks",
    config: { ...SHARED, portfolios: [{ name: "", assets: [{ symbol: "VTI", weight: "100" }] }] },
  },
  {
    key: "global",
    config: {
      ...SHARED,
      portfolios: [
        {
          name: "",
          assets: [
            { symbol: "VTI", weight: "60" },
            { symbol: "VXUS", weight: "25" },
            { symbol: "BND", weight: "15" },
          ],
        },
      ],
    },
  },
  {
    // ชุดที่ทำให้ผู้ใช้เห็นเองว่าใส่หุ้นไทยได้ (BR-SET-04) — ฐานเงินบาทเพราะเป็นพอร์ตของคนไทย
    key: "thaiAndWorld",
    config: {
      startYear: 2015,
      endYear: 2025,
      amount: 350_000,
      benchmark: "SPY",
      baseCurrency: "THB",
      inflationAdjusted: false,
      portfolios: [
        {
          name: "",
          assets: [
            { symbol: "PTT.BK", weight: "30" },
            { symbol: "CPALL.BK", weight: "30" },
            { symbol: "VTI", weight: "40" },
          ],
        },
      ],
    },
  },
]

/** ลิงก์ไปหน้าทดสอบพร้อมค่าครบ ทำให้ผลแสดงทันทีโดยไม่ต้องกดอะไรอีก (BR-DMO-03) */
export function demoPortfolioHref(portfolio: DemoPortfolio): string {
  return `/backtest?${encodeConfig(portfolio.config)}`
}

/** ส่วนผสมแบบอ่านง่ายสำหรับแสดงบนการ์ด เช่น "VTI 60% · BND 40%" */
export function demoPortfolioMix(portfolio: DemoPortfolio): string {
  return portfolio.config.portfolios[0].assets.map((a) => `${a.symbol} ${a.weight}%`).join(" · ")
}
