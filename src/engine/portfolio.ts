import {
  compareMonths,
  parseYearMonth,
  type MonthlyReturn,
  type MonthRange,
  type YearMonth,
} from "@/types/series"

export type PortfolioAsset = {
  symbol: string
  /** น้ำหนักเป้าหมาย รับเป็นเปอร์เซ็นต์ (60 = 60%) — จะถูก normalize ให้รวมเป็น 1 */
  weight: number
  returns: MonthlyReturn[]
}

export type RebalanceMode = "annual" | "none"

export type PortfolioResult = {
  returns: MonthlyReturn[]
  /** ช่วงที่ทุกสินทรัพย์มีข้อมูลร่วมกัน — null เมื่อไม่มีเดือนใดทับกันเลย */
  usedRange: MonthRange | null
  /** สัญลักษณ์ที่เป็นตัวจำกัดช่วง (ข้อมูลเริ่มช้าสุดหรือจบเร็วสุด) สำหรับข้อความ N-001 */
  limitedBy: string[]
}

const EMPTY: PortfolioResult = { returns: [], usedRange: null, limitedBy: [] }

/**
 * ผลตอบแทนรายเดือนของพอร์ต (BR-ENG-01..03, BR-ENG-14)
 *
 * น้ำหนักลอยไปตามผลตอบแทนระหว่างปี แล้วถูกดึงกลับสู่น้ำหนักเป้าหมาย ณ สิ้นเดือนธันวาคม
 * ฟังก์ชันบริสุทธิ์: ผลลัพธ์ขึ้นกับข้อมูลนำเข้าเท่านั้น
 */
export function portfolioReturns(
  assets: PortfolioAsset[],
  options: { rebalance?: RebalanceMode } = {},
): PortfolioResult {
  const rebalance = options.rebalance ?? "annual"
  if (assets.length === 0) return EMPTY

  const overlap = commonRange(assets)
  if (!overlap) return { ...EMPTY, limitedBy: assets.map((a) => a.symbol) }

  const months = monthsInRange(overlap.range)
  if (months.length === 0) return { ...EMPTY, limitedBy: overlap.limitedBy }

  const targetWeights = normalizeWeights(assets.map((a) => a.weight))
  const lookup = assets.map((a) => indexReturns(a.returns))

  // มูลค่าสมมติต่อสินทรัพย์ เริ่มที่น้ำหนักเป้าหมาย รวมกันได้ 1
  let holdings = [...targetWeights]
  const returns: MonthlyReturn[] = []

  for (const month of months) {
    const before = holdings.reduce((sum, v) => sum + v, 0)

    holdings = holdings.map((value, i) => {
      const monthly = lookup[i].get(month)
      // ทุกเดือนในช่วงร่วมต้องมีค่าครบทุกสินทรัพย์อยู่แล้ว แต่กันไว้ไม่ให้กลายเป็น NaN
      return value * (1 + (monthly ?? 0))
    })

    const after = holdings.reduce((sum, v) => sum + v, 0)
    returns.push({ month, value: before > 0 ? after / before - 1 : 0 })

    // ดึงน้ำหนักกลับสู่เป้าหมาย ณ สิ้นปี (BR-ENG-03) — ไม่มีค่าธรรมเนียมและภาษี
    if (rebalance === "annual" && parseYearMonth(month).month === 12) {
      holdings = targetWeights.map((w) => w * after)
    }
  }

  return { returns, usedRange: overlap.range, limitedBy: overlap.limitedBy }
}

export type SharedRange = { range: MonthRange; limitedBy: string[] }

/**
 * ช่วงที่ทุกสินทรัพย์มีข้อมูลร่วมกัน พร้อมบอกว่าใครเป็นตัวจำกัด (BR-ENG-14)
 *
 * ส่งออกให้ชั้นบนใช้หาช่วงร่วมของ **ทุกพอร์ตรวมกัน** ก่อนคำนวณ (BR-CMP-04) — ต้องตัดชุดผลตอบแทน
 * ให้อยู่ในช่วงร่วมก่อนเรียก `portfolioReturns` เสมอ เพราะน้ำหนักลอยและถูกดึงกลับตามรอบ
 * การตัดผลลัพธ์ทีหลังจะได้ค่าของพอร์ตที่น้ำหนักลอยมาจากเดือนที่ไม่ได้อยู่ในช่วงร่วม
 */
export function commonRange(
  assets: Array<{ symbol: string; returns: MonthlyReturn[] }>,
): SharedRange | null {
  const spans = assets.map((asset) => ({
    symbol: asset.symbol,
    first: asset.returns[0]?.month,
    last: asset.returns[asset.returns.length - 1]?.month,
  }))
  if (spans.some((s) => !s.first || !s.last)) return null

  let start = spans[0].first as YearMonth
  let end = spans[0].last as YearMonth
  for (const span of spans) {
    if (compareMonths(span.first as YearMonth, start) > 0) start = span.first as YearMonth
    if (compareMonths(span.last as YearMonth, end) < 0) end = span.last as YearMonth
  }
  if (compareMonths(start, end) > 0) return null

  const limitedBy = spans
    .filter((s) => s.first === start || s.last === end)
    .map((s) => s.symbol)

  return { range: { start, end }, limitedBy }
}

function monthsInRange(range: MonthRange): YearMonth[] {
  const months: YearMonth[] = []
  const from = parseYearMonth(range.start)
  const to = parseYearMonth(range.end)
  let year = from.year
  let month = from.month
  while (year < to.year || (year === to.year && month <= to.month)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`)
    if (++month > 12) {
      month = 1
      year++
    }
  }
  return months
}

/** น้ำหนักถูก normalize ให้รวมเป็น 1 เสมอ รองรับความคลาดที่ฟอร์มยอมให้ผ่าน (BR-ENG-01) */
function normalizeWeights(weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return weights.map(() => 1 / weights.length)
  return weights.map((w) => w / total)
}

function indexReturns(returns: MonthlyReturn[]): Map<YearMonth, number> {
  const map = new Map<YearMonth, number>()
  for (const item of returns) map.set(item.month, item.value)
  return map
}
