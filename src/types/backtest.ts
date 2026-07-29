export type PortfolioRow = {
  symbol: string
  /** น้ำหนักเป็นเปอร์เซ็นต์ (60 = 60%) เก็บเป็นข้อความเพราะผู้ใช้กำลังพิมพ์ */
  weight: string
}

export type BacktestConfig = {
  assets: PortfolioRow[]
  startYear: number
  endYear: number
  amount: number
  benchmark: string
}

/** ขอบเขตของฟอร์มตาม BR-CFG-02, BR-CFG-08 */
export const MIN_ASSETS = 1
export const MAX_ASSETS = 10
export const MIN_AMOUNT = 1
export const MAX_AMOUNT = 1_000_000_000
export const DEFAULT_AMOUNT = 10_000
export const DEFAULT_BENCHMARK = "SPY"
/** ช่วงเวลาเริ่มต้น = 10 ปีล่าสุด ตาม BR-CFG-16 */
export const DEFAULT_YEARS_BACK = 10
export const WEIGHT_SUM_TOLERANCE = 0.01
export const SYMBOL_PATTERN = /^[A-Za-z][A-Za-z0-9.-]{0,9}$/
