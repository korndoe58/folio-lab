import {
  compareMonths,
  parseYearMonth,
  type MonthlyReturn,
  type MonthRange,
  type YearMonth,
} from "@/types/series"
import { cashflowPeriods, plannedAmount, type CashflowPlan } from "./cashflow"
import type { GrowthPoint } from "./growth"
import type { InflationRate } from "./inflation"

export type PortfolioAsset = {
  symbol: string
  /** น้ำหนักเป้าหมาย รับเป็นเปอร์เซ็นต์ (60 = 60%) — จะถูก normalize ให้รวมเป็น 1 */
  weight: number
  returns: MonthlyReturn[]
}

/** วิธีดึงน้ำหนักกลับสู่เป้าหมาย (BR-CMP-53) */
export type RebalanceMode = "none" | "monthly" | "quarterly" | "annual" | "bands"

export type PortfolioOptions = {
  rebalance?: RebalanceMode
  /** เกณฑ์เบี่ยงเบนเป็นจุดเปอร์เซ็นต์ ใช้เมื่อเลือกแบบ bands (BR-CMP-56) */
  bandPoints?: number
  /** เงินตั้งต้นของเส้นมูลค่า — ปริยาย 1 คือเส้นการเติบโตของเงินหนึ่งหน่วย */
  initialAmount?: number
  /** แผนเงินเข้าออก — ไม่ส่งมา = ไม่มีเงินเข้าออก ซึ่งให้ผลเท่าเดิมทุกหลัก (BR-CMP-33) */
  cashflow?: CashflowPlan | null
  inflationRates?: InflationRate[]
}

export type PortfolioResult = {
  returns: MonthlyReturn[]
  /** ช่วงที่ทุกสินทรัพย์มีข้อมูลร่วมกัน — null เมื่อไม่มีเดือนใดทับกันเลย */
  usedRange: MonthRange | null
  /** สัญลักษณ์ที่เป็นตัวจำกัดช่วง (ข้อมูลเริ่มช้าสุดหรือจบเร็วสุด) สำหรับข้อความ N-001 */
  limitedBy: string[]
  /** จำนวนครั้งที่ปรับสมดุลตามรอบ — ไม่นับการใส่เงิน (BR-CMP-63) */
  rebalanceCount: number
  /** เส้นมูลค่าที่รวมเงินเข้าออกแล้ว จุดแรกคือจุดตั้งต้นก่อนเดือนแรก (BR-CMP-39) */
  values: GrowthPoint[]
  /** เงินที่ใส่เพิ่มของแต่ละเดือน (ไม่รวมเงินตั้งต้น) และเงินที่ถอนได้จริงของแต่ละเดือน */
  deposits: number[]
  withdrawals: number[]
  /** เดือนที่ถูกถอนจนหมด — null เมื่อยังไม่หมด (BR-CMP-50) */
  depletedAt: YearMonth | null
  /**
   * น้ำหนักจริงของแต่ละสินทรัพย์ ณ ต้นเดือนนั้น เรียงตามลำดับเดือนใน `returns`
   * — ค่าที่ลูปคำนวณอยู่แล้ว ส่งออกมาให้ส่วนแบ่งผลตอบแทนใช้ ([PD-023](../../docs/product/decision-log.md))
   */
  weights: number[][]
}

const EMPTY: PortfolioResult = {
  returns: [],
  usedRange: null,
  limitedBy: [],
  rebalanceCount: 0,
  values: [],
  deposits: [],
  withdrawals: [],
  depletedAt: null,
  weights: [],
}

/**
 * ผลตอบแทนรายเดือนและเส้นมูลค่าของพอร์ต (BR-ENG-01..03, BR-ENG-14, US-18, US-19)
 *
 * **ลำดับภายในหนึ่งเดือนคือสิ่งที่กำหนดตัวเลขทุกตัว:**
 * คิดผลตอบแทนของเดือนจากน้ำหนักก่อนหน้า → ปรับสมดุลถ้าถึงรอบ → แล้วจึงใส่หรือถอนเงิน
 * เงินที่ใส่เดือนนี้จึงยังไม่ได้ผลตอบแทนของเดือนนี้ (BR-CMP-37)
 *
 * ติดตาม**น้ำหนัก**แยกจาก**มูลค่า** เพราะผลตอบแทนเป็นเรื่องของสัดส่วนล้วน ๆ — เงินเข้าออกที่
 * กระจายตามสัดส่วนที่ถืออยู่จึงไม่แตะชุดผลตอบแทนเลย ส่วนแบบตามน้ำหนักเป้าหมายแตะ เพราะ
 * เป็นการดึงน้ำหนักกลับเข้าเป้าไปในตัว ([PD-016](../../docs/product/decision-log.md))
 *
 * ฟังก์ชันบริสุทธิ์: ผลลัพธ์ขึ้นกับข้อมูลนำเข้าเท่านั้น
 */
export function portfolioReturns(
  assets: PortfolioAsset[],
  options: PortfolioOptions = {},
): PortfolioResult {
  const mode = options.rebalance ?? "annual"
  const initialAmount = options.initialAmount ?? 1
  const plan = options.cashflow ?? null
  const rates = options.inflationRates ?? []
  if (assets.length === 0) return EMPTY

  const overlap = commonRange(assets)
  if (!overlap) return { ...EMPTY, limitedBy: assets.map((a) => a.symbol) }

  const months = monthsInRange(overlap.range)
  if (months.length === 0) return { ...EMPTY, limitedBy: overlap.limitedBy }

  const targetWeights = normalizeWeights(assets.map((a) => a.weight))
  const lookup = assets.map((a) => indexReturns(a.returns))
  const periods = plan ? cashflowPeriods(months.length, plan.frequency) : new Set<number>()
  const firstYear = parseYearMonth(months[0]).year

  let weights = [...targetWeights]
  let value = initialAmount
  let rebalanceCount = 0
  let depletedAt: YearMonth | null = null

  const returns: MonthlyReturn[] = []
  const values: GrowthPoint[] = [{ month: null, value }]
  const deposits: number[] = []
  const withdrawals: number[] = []
  const monthlyWeights: number[][] = []

  months.forEach((month, index) => {
    /**
     * น้ำหนักที่ "ทำงาน" ในเดือนนี้คือน้ำหนัก**ก่อน**ราคาขยับ — ส่วนแบ่งผลตอบแทนจึงต้องใช้ตัวนี้
     * คู่กับผลตอบแทนของเดือนเดียวกัน (BR-RSK-35) · เก็บสำเนาไว้เฉย ๆ ไม่มีการคำนวณใหม่
     * และไม่มีสูตรใดถูกแตะ ([PD-023](../../docs/product/decision-log.md))
     */
    monthlyWeights.push([...weights])

    // 1–3 · ผลตอบแทนของเดือน คิดจากน้ำหนักก่อนหน้า ก่อนเงินเข้าออกเสมอ
    const grown = weights.map((weight, i) => {
      // ทุกเดือนในช่วงร่วมต้องมีค่าครบทุกสินทรัพย์อยู่แล้ว แต่กันไว้ไม่ให้กลายเป็น NaN
      const monthly = lookup[i].get(month) ?? 0
      return weight * (1 + monthly)
    })
    const growth = grown.reduce((sum, v) => sum + v, 0)
    returns.push({ month, value: growth - 1 })
    weights = growth > 0 ? grown.map((v) => v / growth) : [...targetWeights]
    value *= growth

    // 4 · ปรับสมดุลตามรอบ — ไม่มีค่าธรรมเนียมและภาษี (BR-CMP-58)
    if (shouldRebalance(mode, month, weights, targetWeights, options.bandPoints)) {
      weights = [...targetWeights]
      rebalanceCount++
    }

    // 5 · เงินเข้าออกของงวดนั้น
    let deposited = 0
    let withdrawn = 0
    if (plan && periods.has(index)) {
      const year = parseYearMonth(month).year
      if (plan.direction === "deposit") {
        deposited = depositAmount(plan, year, firstYear, rates, value)
        if (deposited > 0) {
          const next = value + deposited
          if (plan.allocation === "target") {
            // ดึงน้ำหนักเข้าหาเป้าไปในตัว — ชุดผลตอบแทนของเดือนถัด ๆ ไปจึงเปลี่ยน
            weights = weights.map((w, i) => (w * value + deposited * targetWeights[i]) / next)
          }
          value = next
        }
      } else {
        const wanted =
          plan.basis === "percent"
            ? value * (plan.amount / 100)
            : plannedAmount(plan, year, firstYear, rates)
        // ถอนได้เท่าที่มี แล้วงวดถัด ๆ ไปถอนไม่ได้อีก (BR-CMP-50)
        withdrawn = Math.max(0, Math.min(wanted, value))
        value -= withdrawn
        // ถอนตามสัดส่วนที่ถืออยู่ น้ำหนักจึงไม่ขยับ (BR-CMP-60)
        if (value <= 0 && depletedAt === null) depletedAt = month
      }
    }

    deposits.push(deposited)
    withdrawals.push(withdrawn)
    values.push({ month, value })
  })

  return {
    returns,
    usedRange: overlap.range,
    limitedBy: overlap.limitedBy,
    rebalanceCount,
    values,
    deposits,
    withdrawals,
    depletedAt,
    weights: monthlyWeights,
  }
}

function depositAmount(
  plan: CashflowPlan,
  year: number,
  firstYear: number,
  rates: InflationRate[],
  value: number,
): number {
  if (plan.basis === "percent") return value * (plan.amount / 100)
  return plannedAmount(plan, year, firstYear, rates)
}

/** ถึงรอบปรับสมดุลหรือยัง — รอบตามปฏิทิน ส่วนแบบ bands ตรวจการเบี่ยงเบนทุกสิ้นเดือน (BR-CMP-55/56) */
function shouldRebalance(
  mode: RebalanceMode,
  month: YearMonth,
  weights: number[],
  targetWeights: number[],
  bandPoints: number | undefined,
): boolean {
  if (mode === "none") return false
  if (mode === "monthly") return true

  const { month: calendarMonth } = parseYearMonth(month)
  if (mode === "annual") return calendarMonth === 12
  if (mode === "quarterly") return calendarMonth % 3 === 0

  const band = (bandPoints ?? 0) / 100
  return weights.some((weight, i) => Math.abs(weight - targetWeights[i]) > band)
}

export type SharedRange = {
  range: MonthRange
  /** สัญลักษณ์ที่เป็นตัวจำกัดช่วง ไม่ว่าจะด้านต้นหรือด้านท้าย */
  limitedBy: string[]
  /** สัญลักษณ์ที่ข้อมูลเริ่มช้าที่สุด — ตัวที่ทำให้ต้นช่วงขยับ */
  limitedStartBy: string[]
  /** สัญลักษณ์ที่ข้อมูลจบเร็วที่สุด — ตัวที่ทำให้ท้ายช่วงขยับ */
  limitedEndBy: string[]
}

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

  /**
   * แยกตัวที่จำกัด**ต้นช่วง**ออกจากตัวที่จำกัด**ท้ายช่วง**
   *
   * `limitedBy` รวมทั้งสองแบบไว้ด้วยกัน ผู้เรียกที่หยิบตัวแรกไปแสดงจึงอาจได้ชื่อผิด —
   * เช่น พอร์ต VTI (ข้อมูลตั้งแต่ 2012) กับ BTC-USD (ตั้งแต่ 2014) ต้นช่วงถูกจำกัดโดย
   * BTC-USD แต่ VTI ก็ติดอยู่ในรายการเพราะเป็นตัวที่จบท้ายช่วงพอดี
   */
  const limitedStartBy = spans.filter((s) => s.first === start).map((s) => s.symbol)
  const limitedEndBy = spans.filter((s) => s.last === end).map((s) => s.symbol)

  return { range: { start, end }, limitedBy, limitedStartBy, limitedEndBy }
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
