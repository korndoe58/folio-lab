import {
  STRESS_PERIODS,
  WITHDRAWAL_YEARS,
  safeWithdrawalRate,
  stressReturn,
  type InflationRate,
  type WithdrawalResult,
} from "@/engine"
import type { MonthlyReturn } from "@/types/series"

/**
 * ข้อมูลของสองส่วนสุดท้ายในเฟส 4 (US-32, US-33)
 *
 * ไฟล์นี้ทำได้แค่เรียกชั้นคำนวณให้ครบทุกช่วง × ทุกพอร์ต แล้วจัดเรียง —
 * ไม่มีการคำนวณทางการเงินใหม่ ตามแบบเดียวกับ `rolling-data.ts` และ `risk-data.ts`
 */

export type StressRow = {
  key: string
  start: string
  end: string
  /** หนึ่งค่าต่อพอร์ต เรียงตามลำดับพอร์ต — null เมื่อข้อมูลครอบคลุมไม่ครบ (BR-RSK-46) */
  portfolios: Array<number | null>
  benchmark: number | null
}

export type WithdrawalRow = {
  years: number
  /** หนึ่งชุดต่อพอร์ต เรียงตามลำดับพอร์ต */
  portfolios: WithdrawalResult[]
}

export type Phase4Data = {
  stress: StressRow[]
  withdrawal: WithdrawalRow[]
}

export function buildPhase4Data(input: {
  portfolios: MonthlyReturn[][]
  benchmark: MonthlyReturn[]
  inflationRates: InflationRate[]
}): Phase4Data {
  const { portfolios, benchmark, inflationRates } = input

  return {
    // ทุกช่วงแสดงผลของทุกพอร์ต **บวกตัวเทียบ** (BR-RSK-45)
    stress: STRESS_PERIODS.map((period) => ({
      key: period.key,
      start: period.start,
      end: period.end,
      portfolios: portfolios.map((series) => stressReturn(series, period)),
      benchmark: stressReturn(benchmark, period),
    })),

    /**
     * อัตราถอนไม่มีคอลัมน์ตัวเทียบ เพราะคำถามคือ "พอร์ต**ของคุณ**ถอนได้เท่าไร"
     * ไม่ใช่การเทียบกับตลาด · และส่วนนี้ไม่รับเงินเข้าออกที่ผู้ใช้ตั้งไว้ (BR-RSK-59)
     */
    withdrawal: WITHDRAWAL_YEARS.map((years) => ({
      years,
      portfolios: portfolios.map((series) =>
        safeWithdrawalRate({ returns: series, years, inflationRates }),
      ),
    })),
  }
}
