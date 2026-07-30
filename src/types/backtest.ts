import type { Currency } from "@/data/currency"

export type PortfolioRow = {
  symbol: string
  /** น้ำหนักเป็นเปอร์เซ็นต์ (60 = 60%) เก็บเป็นข้อความเพราะผู้ใช้กำลังพิมพ์ */
  weight: string
}

/**
 * หนึ่งพอร์ตในการเทียบ (BR-CMP-15, BR-CMP-16)
 * ชื่อว่างหมายถึงยังไม่ได้ตั้งเอง — หน้าจอเติมชื่อปริยายให้ตามลำดับ
 */
export type PortfolioSpec = {
  name: string
  assets: PortfolioRow[]
}

export type BacktestConfig = {
  /** 1 ถึง 3 พอร์ตที่กำลังเทียบกัน (BR-CMP-01) */
  portfolios: PortfolioSpec[]
  startYear: number
  endYear: number
  amount: number
  benchmark: string
  /** สกุลเงินที่ใช้มองผลลัพธ์ทั้งหมด (BR-CUR-01) */
  baseCurrency: Currency
  /** หักเงินเฟ้อไทยออกจากค่าที่ปรับได้หรือไม่ (BR-INF-01) */
  inflationAdjusted: boolean
}

/** ขอบเขตของฟอร์มตาม BR-CFG-02, BR-CFG-08 — ใช้กับทุกพอร์ตแยกกัน (BR-CMP-18) */
export const MIN_ASSETS = 1
export const MAX_ASSETS = 10
/** เทียบได้ 1 ถึง 3 พอร์ต — เกินสามชุดกราฟอ่านไม่ออกและตารางล้นจอแคบ (BR-CMP-01) */
export const MIN_PORTFOLIOS = 1
export const MAX_PORTFOLIOS = 3
export const MAX_PORTFOLIO_NAME = 20
export const MIN_AMOUNT = 1
export const MAX_AMOUNT = 1_000_000_000
export const DEFAULT_AMOUNT = 10_000
export const DEFAULT_BENCHMARK = "SPY"
/** ฟอร์มเปล่าเริ่มที่เงินบาท เพราะผู้ใช้เป้าหมายวางแผนการเงินเป็นเงินบาท (BR-THB-02) */
export const DEFAULT_BASE_CURRENCY: Currency = "THB"
/**
 * ลิงก์ที่ไม่ระบุสกุลเงินถือเป็นดอลลาร์ (BR-CUR-03) — ต่างจากค่าเริ่มต้นของฟอร์มโดยตั้งใจ
 * เพราะลิงก์ทุกอันที่แชร์ออกไปก่อนมีตัวเลือกนี้ คำนวณด้วยดอลลาร์
 */
export const LEGACY_LINK_CURRENCY: Currency = "USD"
export const CURRENCY_OPTIONS: Currency[] = ["THB", "USD"]
/**
 * ฟอร์มเริ่มที่ไม่ปรับเงินเฟ้อ เพื่อให้ค่าที่เห็นครั้งแรกเทียบกับเครื่องมืออื่นได้ตรง ๆ (BR-INF-01)
 * และเพื่อให้ลิงก์ที่แชร์ไปก่อนมีตัวเลือกนี้ยังให้ค่าเดิม (BR-INF-02)
 */
export const DEFAULT_INFLATION_ADJUSTED = false
/** ช่วงเวลาเริ่มต้น = 10 ปีล่าสุด ตาม BR-CFG-16 */
export const DEFAULT_YEARS_BACK = 10
export const WEIGHT_SUM_TOLERANCE = 0.01
export const SYMBOL_PATTERN = /^[A-Za-z][A-Za-z0-9.-]{0,9}$/
