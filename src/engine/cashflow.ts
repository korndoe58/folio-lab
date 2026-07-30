import { parseYearMonth, type MonthlyReturn, type YearMonth } from "@/types/series"
import { cumulativeInflation, type InflationRate } from "./inflation"
import { annualizeGrowth } from "./metrics"

/**
 * เงินเข้าออกระหว่างทาง (US-18)
 *
 * ไฟล์นี้ถือ **นิยามของแผนเงินเข้าออก** และ **ผลตอบแทนถ่วงน้ำหนักเงิน** เท่านั้น
 * ส่วนการเดินมูลค่าจริงอยู่ใน `portfolio.ts` ลูปเดียวกับการปรับสมดุล เพราะสองอย่างนี้ผูกกัน
 * เมื่อผู้ใช้เลือกให้เงินที่ใส่กระจายตามน้ำหนักเป้าหมาย ([PD-016](../../docs/product/decision-log.md))
 */

export type CashflowFrequency = "monthly" | "quarterly" | "annual"
export type CashflowDirection = "deposit" | "withdraw"
/** จำนวนคงที่ หรือเปอร์เซ็นต์ของมูลค่าพอร์ต ณ งวดนั้น (แบบเปอร์เซ็นต์ใช้ได้เฉพาะตอนถอน) */
export type CashflowBasis = "fixed" | "percent"
/** วิธีกระจายเงินที่ใส่เพิ่ม — ตามสัดส่วนที่ถืออยู่ (ไม่ขยับน้ำหนัก) หรือตามน้ำหนักเป้าหมาย (PD-016) */
export type CashflowAllocation = "prorata" | "target"

export type CashflowPlan = {
  direction: CashflowDirection
  /** จำนวนเงินต่องวด หรือเปอร์เซ็นต์ต่องวดเมื่อ basis เป็น percent */
  amount: number
  basis: CashflowBasis
  frequency: CashflowFrequency
  /** เพิ่มจำนวนต่องวดตามเงินเฟ้อไทยทุกต้นปีปฏิทินใหม่ (BR-CMP-49) — ใช้ได้เฉพาะแบบจำนวนคงที่ */
  inflationAdjusted: boolean
  allocation: CashflowAllocation
}

const MONTHS_PER_PERIOD: Record<CashflowFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
}

/**
 * เดือนที่เกิดงวด (BR-CMP-38) — งวดแรกคือสิ้นเดือนแรกของช่วง จากนั้นทุก n เดือน
 * คืนเป็นชุดของดัชนีเดือน เพื่อให้ผู้เดินมูลค่าถามได้เร็วว่าเดือนนี้มีงวดไหม
 */
export function cashflowPeriods(monthCount: number, frequency: CashflowFrequency): Set<number> {
  const step = MONTHS_PER_PERIOD[frequency]
  const periods = new Set<number>()
  for (let i = step - 1; i < monthCount; i += step) periods.add(i)
  return periods
}

/**
 * จำนวนเงินต่องวดของปีนั้น หลังปรับตามเงินเฟ้อสะสมจากปีแรกของช่วง (BR-CMP-49)
 * ปีที่ไม่มีดัชนีถือว่าเงินเฟ้อเป็นศูนย์ ซึ่งเป็นกติกาเดียวกับ US-15
 */
export function plannedAmount(
  plan: CashflowPlan,
  year: number,
  firstYear: number,
  rates: InflationRate[],
): number {
  if (!plan.inflationAdjusted || plan.basis !== "fixed" || year <= firstYear) return plan.amount

  // ปรับ ณ ต้นปีใหม่ด้วยอัตราของปีก่อนหน้า → ปี Y ใช้ผลคูณของปี firstYear..Y−1
  const years = Array.from({ length: year - firstYear }, (_, i) => firstYear + i)
  return plan.amount * cumulativeInflation(years, rates).factor
}

export type PlannedTotal = {
  /** ยอดรวมที่จะใส่ทั้งช่วง — แบบเปอร์เซ็นต์บอกล่วงหน้าไม่ได้เพราะขึ้นกับมูลค่าจริงของแต่ละงวด */
  total: number | null
  periods: number
}

/** ยอดรวมที่ฟอร์มแสดงก่อนกดรัน เพื่อให้เห็นว่ากำลังจะเทียบด้วยเงินคนละก้อนกัน (BR-CMP-51) */
export function plannedTotal(
  plan: CashflowPlan,
  months: MonthlyReturn[],
  rates: InflationRate[],
): PlannedTotal {
  const periods = cashflowPeriods(months.length, plan.frequency)
  if (plan.basis === "percent") return { total: null, periods: periods.size }

  const firstYear = months.length > 0 ? parseYearMonth(months[0].month).year : 0
  let total = 0
  for (const index of periods) {
    total += plannedAmount(plan, parseYearMonth(months[index].month).year, firstYear, rates)
  }
  return { total, periods: periods.size }
}

/** กระแสเงินหนึ่งจังหวะ — `month` คือจำนวนเดือนนับจากต้นช่วง (0 = ก่อนเดือนแรก) */
export type Flow = {
  month: number
  /** ติดลบ = เงินออกจากกระเป๋าผู้ใช้ · เป็นบวก = เงินกลับเข้ากระเป๋า */
  value: number
}

const MONTHS_PER_YEAR = 12
const RATE_LOW = -0.99
const RATE_HIGH = 1.0
const TOLERANCE = 1e-10
const MAX_STEPS = 200

/**
 * ผลตอบแทนต่อปีถ่วงน้ำหนักเงิน (BR-CMP-43, BR-CMP-44)
 *
 * หาอัตราต่อเดือน `r` ที่ทำให้ผลรวมของกระแสเงินทุกจังหวะหารด้วย `(1+r)` ยกกำลังจำนวนเดือน
 * เท่ากับศูนย์ แล้วแปลงเป็นรายปีด้วยสูตรเดียวกับผลตอบแทนต่อปีแบบทบต้น
 *
 * ใช้วิธีแบ่งครึ่งช่วงเพราะให้ผลเท่าเดิมทุกครั้งสำหรับข้อมูลชุดเดิม ต่างจากวิธีที่พึ่งจุดตั้งต้น
 * ซึ่งอาจไม่ลู่เข้าหรือได้คนละคำตอบ · **หาไม่พบ → null ไม่ใช่ 0** (BR-CMP-45)
 */
export function moneyWeightedReturn(flows: Flow[]): number | null {
  const meaningful = flows.filter((flow) => flow.value !== 0)
  const hasIn = meaningful.some((flow) => flow.value < 0)
  const hasOut = meaningful.some((flow) => flow.value > 0)
  // ไม่มีทั้งเงินเข้าและเงินออก สมการไม่มีคำตอบที่ตีความได้
  if (!hasIn || !hasOut) return null

  const npv = (rate: number) =>
    meaningful.reduce((sum, flow) => sum + flow.value / (1 + rate) ** flow.month, 0)

  let low = RATE_LOW
  let high = RATE_HIGH
  let atLow = npv(low)
  let atHigh = npv(high)
  if (!Number.isFinite(atLow) || !Number.isFinite(atHigh)) return null
  // ไม่เปลี่ยนเครื่องหมายในช่วงที่กำหนด แปลว่าคำตอบอยู่นอกช่วงที่ยอมรับ
  if (atLow === 0) return annualizeMonthly(low)
  if (atHigh === 0) return annualizeMonthly(high)
  if (atLow > 0 === atHigh > 0) return null

  for (let step = 0; step < MAX_STEPS; step++) {
    const mid = (low + high) / 2
    const atMid = npv(mid)
    if (Math.abs(atMid) < TOLERANCE || high - low < TOLERANCE) return annualizeMonthly(mid)
    if (atMid > 0 === atLow > 0) {
      low = mid
      atLow = atMid
    } else {
      high = mid
      atHigh = atMid
    }
  }
  return annualizeMonthly((low + high) / 2)
}

function annualizeMonthly(monthlyRate: number): number | null {
  return annualizeGrowth((1 + monthlyRate) ** MONTHS_PER_YEAR, MONTHS_PER_YEAR)
}

/** กระแสเงินของพอร์ตหนึ่งชุด สำหรับส่งเข้า `moneyWeightedReturn` */
export function buildFlows(input: {
  initialAmount: number
  /** เงินที่ใส่ (บวก) หรือถอน (บวก) ของแต่ละเดือน — ดัชนีตรงกับลำดับเดือน */
  deposits: number[]
  withdrawals: number[]
  finalValue: number
}): Flow[] {
  const { initialAmount, deposits, withdrawals, finalValue } = input
  const flows: Flow[] = [{ month: 0, value: -initialAmount }]

  const monthCount = Math.max(deposits.length, withdrawals.length)
  for (let i = 0; i < monthCount; i++) {
    const net = (withdrawals[i] ?? 0) - (deposits[i] ?? 0)
    if (net !== 0) flows.push({ month: i + 1, value: net })
  }

  flows.push({ month: monthCount, value: finalValue })
  return flows
}

/** เดือนที่พอร์ตถูกถอนจนหมด หรือ null เมื่อยังไม่หมด (BR-CMP-50) */
export function depletionMonth(values: Array<{ month: YearMonth | null; value: number }>):
  | YearMonth
  | null {
  for (const point of values) {
    if (point.month !== null && point.value <= 0) return point.month
  }
  return null
}
