import type { MonthlyReturn, YearMonth } from "@/types/series"
import type { InflationRate } from "./inflation"
import { portfolioReturns } from "./portfolio"

/**
 * อัตราถอนปลอดภัย (US-33)
 *
 * **เรียกใช้กลไกถอนเงินเดิม ไม่เขียนตัวจำลองตัวที่สอง** — เป็นข้อยกเว้นที่
 * [PD-020](../../docs/product/decision-log.md) ระบุไว้ · แต่ละหน้าต่างส่งเข้า `portfolioReturns`
 * เป็นสินทรัพย์ตัวเดียวที่มีชุดผลตอบแทนของพอร์ตช่วงนั้น แล้วอ่าน `depletedAt` ที่มันรายงานอยู่แล้ว
 * (BR-RSK-55) · การถอนที่ปรับตามเงินเฟ้อก็ใช้ `CashflowPlan` เดิมทั้งชุด ไม่ต้องเขียนสูตรใหม่
 *
 * **นิยามของคำว่า "ปลอดภัย" คือรอด _ทุก_ หน้าต่าง ไม่ใช่รอดโดยเฉลี่ย** (BR-RSK-51) —
 * การแบ่งครึ่งช่วงจึงทำครั้งเดียวโดยมีเงื่อนไขว่า "อัตรานี้รอดทุกหน้าต่างไหม"
 */

const MONTHS_PER_YEAR = 12
/** ระยะที่รองรับ (BR-RSK-53) */
export const WITHDRAWAL_YEARS = [10, 20, 30] as const
/** เพดานบนของการค้นหา — เกินนี้ถือว่า "มากกว่า 20%" (BR-RSK-56, EC-RSK-22) */
const MAX_RATE = 0.2
/** หยุดแบ่งครึ่งเมื่อคลาดน้อยกว่า 0.01 จุดเปอร์เซ็นต์ (BR-RSK-56) */
const TOLERANCE = 0.0001
/** เงินตั้งต้นสมมติของการจำลอง — อัตราเป็นสัดส่วน ผลจึงไม่ขึ้นกับตัวเลขนี้ */
const SIMULATION_BASE = 10_000

export type WithdrawalResult = {
  years: number
  /** อัตราต่อปีเป็นสัดส่วนของเงินตั้งต้น — null เมื่อข้อมูลสั้นกว่าระยะ (BR-RSK-53) */
  rate: number | null
  /** จำนวนจังหวะเข้าที่ทดสอบ (BR-RSK-58) */
  windows: number
  /** หน้าต่างที่บีบที่สุด คือเหลือเงินน้อยที่สุดที่อัตราซึ่งหาได้ (BR-RSK-58) */
  worstWindowStart: YearMonth | null
  /** true เมื่อแม้แต่เพดาน 20% ก็ยังรอด — จอต้องบอกว่า "มากกว่า 20%" (EC-RSK-22) */
  atCeiling: boolean
}

/** มูลค่าที่เหลือเมื่อจบหน้าต่าง — `null` แปลว่าถูกถอนจนหมดก่อนครบระยะ */
function endValueAfterWithdrawals(
  window: MonthlyReturn[],
  annualRate: number,
  inflationRates: InflationRate[],
): number | null {
  const result = portfolioReturns([{ symbol: "PORTFOLIO", weight: 100, returns: window }], {
    initialAmount: SIMULATION_BASE,
    inflationRates,
    cashflow: {
      direction: "withdraw",
      // ถอนเป็นจำนวนคงที่ต่อเดือน คิดจาก**เงินตั้งต้น** ไม่ใช่มูลค่า ณ ตอนถอน (BR-RSK-52)
      amount: (annualRate * SIMULATION_BASE) / MONTHS_PER_YEAR,
      basis: "fixed",
      frequency: "monthly",
      // ปรับขึ้นตามเงินเฟ้อไทยทุกต้นปี — กลไกเดิมของ US-18 จัดการให้
      inflationAdjusted: true,
      allocation: "prorata",
    },
  })

  if (result.depletedAt !== null) return null
  return result.values.at(-1)?.value ?? null
}

/** หน้าต่างทุกจังหวะเข้า เลื่อนทีละหนึ่งเดือน เหมือนกติกาของ US-20 (BR-RSK-54) */
function windowsOf(returns: MonthlyReturn[], months: number): MonthlyReturn[][] {
  if (returns.length < months) return []
  return Array.from({ length: returns.length - months + 1 }, (_, i) =>
    returns.slice(i, i + months),
  )
}

export function safeWithdrawalRate(input: {
  returns: MonthlyReturn[]
  years: number
  inflationRates: InflationRate[]
}): WithdrawalResult {
  const { returns, years, inflationRates } = input
  const months = years * MONTHS_PER_YEAR
  const windows = windowsOf(returns, months)

  if (windows.length === 0) {
    return { years, rate: null, windows: 0, worstWindowStart: null, atCeiling: false }
  }

  /** อัตรานี้รอดทุกหน้าต่างไหม — นิยามของ "ปลอดภัย" (BR-RSK-51) */
  const survivesEveryWindow = (rate: number) =>
    windows.every((window) => endValueAfterWithdrawals(window, rate, inflationRates) !== null)

  if (survivesEveryWindow(MAX_RATE)) {
    return {
      years,
      rate: MAX_RATE,
      windows: windows.length,
      worstWindowStart: bindingWindow(windows, MAX_RATE, inflationRates),
      atCeiling: true,
    }
  }

  // แบ่งครึ่งช่วงบน 0%–20% · ขอบล่างรอดเสมอ ขอบบนไม่รอด จนช่วงแคบกว่าเกณฑ์
  let low = 0
  let high = MAX_RATE
  while (high - low > TOLERANCE) {
    const middle = (low + high) / 2
    if (survivesEveryWindow(middle)) low = middle
    else high = middle
  }

  return {
    years,
    rate: low,
    windows: windows.length,
    worstWindowStart: bindingWindow(windows, low, inflationRates),
    atCeiling: false,
  }
}

/**
 * หน้าต่างที่บีบที่สุด = เหลือเงินน้อยที่สุดเมื่อถอนด้วยอัตราที่หาได้
 * เป็นหน้าต่างที่กำหนดคำตอบ เพราะถ้าถอนมากกว่านี้อีกนิด มันจะเป็นตัวแรกที่หมด
 */
function bindingWindow(
  windows: MonthlyReturn[][],
  rate: number,
  inflationRates: InflationRate[],
): YearMonth | null {
  let worst: { start: YearMonth; value: number } | null = null
  for (const window of windows) {
    const value = endValueAfterWithdrawals(window, rate, inflationRates)
    if (value === null) return window[0].month
    if (worst === null || value < worst.value) worst = { start: window[0].month, value }
  }
  return worst?.start ?? null
}
