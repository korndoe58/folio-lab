import { describe, expect, test } from "vitest"
import cpiFixture from "@/data/fixtures/th-cpi.json"
import type { MonthlyReturn } from "@/types/series"
import {
  annualReturns,
  coveredYears,
  cumulativeInflation,
  realAnnualReturns,
  realCagr,
  realEndBalance,
  type InflationRate,
} from "./index"

/**
 * ทุกตัวเลขที่คาดหวังในไฟล์นี้คำนวณมือได้ ตาม R16 — เขียนวิธีคำนวณไว้ข้างเคสเสมอ
 */
const RATES: InflationRate[] = cpiFixture.rates

const series = (start: string, values: number[]): MonthlyReturn[] => {
  let [year, month] = start.split("-").map(Number)
  return values.map((value) => {
    const m = `${year}-${String(month).padStart(2, "0")}`
    if (++month > 12) {
      month = 1
      year++
    }
    return { month: m, value }
  })
}

/** ปีเต็มที่ให้ผลตอบแทนตามที่ต้องการพอดี โดยกระจายลงเดือนแรกเดือนเดียว */
const fullYear = (year: number, value: number): MonthlyReturn[] =>
  series(`${year}-01`, [value, ...Array<number>(11).fill(0)])

describe("BR-INF-05 ผลตอบแทนรายปีหลังหักเงินเฟ้อ", () => {
  test("AC-INF-02 ได้ 10% ในปีที่เงินเฟ้อ 6% → 3.77% ไม่ใช่ 4%", () => {
    const annual = annualReturns(fullYear(2024, 0.1))
    const [real] = realAnnualReturns(annual, [{ year: 2024, value: 0.06 }])

    // 1.10 ÷ 1.06 − 1 = 0.0377358...
    expect(real.value).toBeCloseTo(0.0377358490566, 12)
    expect(real.value).not.toBeCloseTo(0.04, 4)
  })

  test("EC-INF-01 ปีที่เงินเฟ้อติดลบ ค่าหลังปรับสูงกว่าค่าปกติ", () => {
    // 2015 = −0.90% และ 2020 = −0.85% ในชุดข้อมูลจริง
    for (const year of [2015, 2020]) {
      const rate = RATES.find((r) => r.year === year)!
      expect(rate.value, `ปี ${year} ต้องเป็นเงินเฟ้อติดลบ`).toBeLessThan(0)

      const annual = annualReturns(fullYear(year, 0.05))
      const [real] = realAnnualReturns(annual, RATES)
      expect(real.value).toBeGreaterThan(0.05)
      // 1.05 ÷ (1 + i) − 1
      expect(real.value).toBeCloseTo(1.05 / (1 + rate.value) - 1, 12)
    }
  })

  test("EC-INF-04 พอร์ตที่ติดลบอยู่แล้ว ยิ่งติดลบ ไม่ตัดที่ศูนย์", () => {
    const annual = annualReturns(fullYear(2022, -0.15))
    const [real] = realAnnualReturns(annual, RATES)
    const rate2022 = RATES.find((r) => r.year === 2022)!

    // 2022 เป็นปีที่เงินเฟ้อไทยพุ่งถึงราว 6.08%
    expect(rate2022.value).toBeCloseTo(0.0608, 4)
    // 0.85 ÷ 1.0608 − 1 ≈ −0.1987
    expect(real.value).toBeLessThan(-0.15)
    expect(real.value).toBeCloseTo(-0.1987, 4)
    expect(real.value).toBeCloseTo(0.85 / (1 + rate2022.value) - 1, 12)
  })

  test("BR-INF-09 ปีที่ไม่มีดัชนี คืนค่าเดิมไม่แตะ", () => {
    const annual = annualReturns(fullYear(2026, 0.08))
    const [real] = realAnnualReturns(annual, RATES)

    expect(RATES.some((r) => r.year === 2026)).toBe(false)
    expect(real.value).toBe(annual[0].value)
  })

  test("คงรายละเอียดของปีไม่เต็มไว้ครบ", () => {
    const annual = annualReturns(series("2024-01", [0.02, 0.02, 0.02]))
    const [real] = realAnnualReturns(annual, [{ year: 2024, value: 0.06 }])

    expect(real.partial).toBe(true)
    expect(real.monthsCovered).toBe(3)
    expect(real.firstMonth).toBe("2024-01")
    expect(real.lastMonth).toBe("2024-03")
  })
})

describe("BR-INF-09 ตัวคูณเงินเฟ้อสะสม", () => {
  test("คูณกันทุกปีในช่วง", () => {
    const { factor, missingYears } = cumulativeInflation(
      [2021, 2022, 2023],
      [
        { year: 2021, value: 0.0123 },
        { year: 2022, value: 0.0608 },
        { year: 2023, value: 0.0123 },
      ],
    )

    // 1.0123 × 1.0608 × 1.0123 = 1.086913...
    expect(factor).toBeCloseTo(1.0123 * 1.0608 * 1.0123, 12)
    expect(missingYears).toEqual([])
  })

  test("ปีที่ไม่มีดัชนีคูณด้วย 1 แล้วถูกรายงานออกมา", () => {
    const { factor, missingYears } = cumulativeInflation(
      [2024, 2025, 2026],
      [{ year: 2024, value: 0.004 }],
    )

    expect(factor).toBeCloseTo(1.004, 12)
    expect(missingYears).toEqual([2025, 2026])
  })

  test("ไม่มีปีเลย ได้ตัวคูณ 1", () => {
    expect(cumulativeInflation([], RATES)).toEqual({ factor: 1, missingYears: [] })
  })

  test("ช่วงข้อมูลจริง 2015 ถึง 2025 ตรงกับผลคูณที่คำนวณมือ", () => {
    const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
    const { factor, missingYears } = cumulativeInflation(years, RATES)

    const byHand = years.reduce(
      (acc, year) => acc * (1 + RATES.find((r) => r.year === year)!.value),
      1,
    )
    expect(factor).toBeCloseTo(byHand, 12)
    expect(missingYears).toEqual([])
    // ราคาสินค้าปี 2025 แพงกว่าปี 2015 ประมาณ 10 เปอร์เซ็นต์
    expect(factor).toBeGreaterThan(1.09)
    expect(factor).toBeLessThan(1.12)
  })
})

describe("BR-INF-06 มูลค่าสุดท้ายและผลตอบแทนต่อปีหลังหักเงินเฟ้อ", () => {
  test("มูลค่าสุดท้ายหารด้วยตัวคูณสะสม", () => {
    expect(realEndBalance(24_884, 1.1)).toBeCloseTo(22_621.8181818, 6)
  })

  test("ผลตอบแทนต่อปีคำนวณใหม่จากมูลค่าที่ปรับแล้ว ด้วยสูตรเดิม", () => {
    // เงินตั้งต้น 10,000 โต 10 ปีเป็น 20,000 แล้วราคาสินค้าแพงขึ้น 1.1 เท่า
    // 20,000 ÷ 1.1 = 18,181.81 → (1.818181)^(12/120) − 1 = 0.0616...
    const real = realCagr(realEndBalance(20_000, 1.1), 10_000, 120)
    expect(real).toBeCloseTo((20_000 / 1.1 / 10_000) ** (12 / 120) - 1, 12)
    expect(real).toBeCloseTo(0.0616, 4)
  })

  test("ต่ำกว่าค่าปกติเสมอเมื่อเงินเฟ้อเป็นบวก", () => {
    const nominal = realCagr(20_000, 10_000, 120)!
    const real = realCagr(realEndBalance(20_000, 1.1), 10_000, 120)!
    expect(real).toBeLessThan(nominal)
  })

  test("มูลค่าที่ปรับแล้วเหลือศูนย์หรือติดลบ ไม่มีค่า ไม่ใช่ 0 (BR-ENG-15)", () => {
    expect(realCagr(0, 10_000, 120)).toBeNull()
    expect(realCagr(5_000, 0, 120)).toBeNull()
    expect(realCagr(5_000, 10_000, 0)).toBeNull()
  })
})

describe("ปีที่ช่วงข้อมูลแตะ", () => {
  test("EC-INF-02 ช่วงสั้นกว่าหนึ่งปี ยังนับปีนั้นเต็มปี", () => {
    expect(coveredYears(series("2024-06", [0, 0, 0]))).toEqual([2024])
  })

  test("ช่วงคร่อมปี ได้ทุกปีที่แตะ เรียงจากน้อยไปมาก", () => {
    expect(coveredYears(series("2023-11", [0, 0, 0, 0]))).toEqual([2023, 2024])
  })

  test("ไม่มีข้อมูล ได้รายการว่าง", () => {
    expect(coveredYears([])).toEqual([])
  })
})

describe("EC-INF-05 ความคงที่", () => {
  test("ปรับซ้ำกี่ครั้งก็ได้ค่าเดิม", () => {
    const annual = annualReturns(series("2020-01", Array<number>(60).fill(0.005)))
    const once = realAnnualReturns(annual, RATES)
    const twice = realAnnualReturns(annual, RATES)
    expect(twice).toEqual(once)
  })

  test("ปรับแล้วคูณเงินเฟ้อกลับ ได้ค่าปกติคืนทุกหลัก", () => {
    const annual = annualReturns(series("2018-01", Array<number>(84).fill(0.004)))
    const real = realAnnualReturns(annual, RATES)

    for (const [i, item] of real.entries()) {
      const rate = RATES.find((r) => r.year === item.year)
      if (!rate) continue
      expect((1 + item.value) * (1 + rate.value) - 1).toBeCloseTo(annual[i].value, 12)
    }
  })
})
