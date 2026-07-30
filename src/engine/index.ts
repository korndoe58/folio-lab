/**
 * ชั้นคำนวณ — ฟังก์ชันบริสุทธิ์ทั้งหมด (BR-ENG-13, BR-FND-04)
 *
 * ห้ามติดต่อภายนอก ห้ามอ่านเวลาปัจจุบัน ห้ามสุ่มค่า ข้อมูลทุกอย่างรับผ่านพารามิเตอร์
 * ค่าที่คำนวณไม่ได้ตามนิยามคืน null เสมอ ไม่ใช่ 0 (BR-ENG-15)
 */
export {
  commonRange,
  portfolioReturns,
  type PortfolioAsset,
  type PortfolioResult,
  type RebalanceMode,
  type SharedRange,
} from "./portfolio"
export { growthSeries, endBalance, type GrowthPoint } from "./growth"
export { cagr, annualizeGrowth, annualizedStdev, sharpe, sortino } from "./metrics"
export { annualReturns, bestWorstFullYears, type AnnualReturn } from "./annual"
export {
  coveredYears,
  cumulativeInflation,
  realAnnualReturns,
  realCagr,
  realEndBalance,
  type CumulativeInflation,
  type InflationRate,
} from "./inflation"
export {
  underwaterSeries,
  drawdownPeriods,
  maxDrawdown,
  type DrawdownPeriod,
  type UnderwaterPoint,
} from "./drawdown"
