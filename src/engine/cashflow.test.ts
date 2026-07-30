import { describe, expect, test } from "vitest"
import cpiFixture from "@/data/fixtures/th-cpi.json"
import type { MonthlyReturn } from "@/types/series"
import {
  buildFlows,
  cagr,
  cashflowPeriods,
  moneyWeightedReturn,
  plannedAmount,
  plannedTotal,
  portfolioReturns,
  type CashflowPlan,
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

const plan = (overrides: Partial<CashflowPlan> = {}): CashflowPlan => ({
  direction: "deposit",
  amount: 100,
  basis: "fixed",
  frequency: "monthly",
  inflationAdjusted: false,
  allocation: "prorata",
  ...overrides,
})

/** พอร์ตสินทรัพย์เดียวที่ผลตอบแทนเป็นไปตามที่กำหนด ใช้ทดสอบเงินเข้าออกล้วน ๆ */
const single = (returns: MonthlyReturn[], options = {}) =>
  portfolioReturns([{ symbol: "X", weight: 100, returns }], { initialAmount: 100, ...options })

describe("BR-CMP-38 งวดของเงินเข้าออก", () => {
  test("รายเดือนเกิดทุกเดือน เริ่มที่สิ้นเดือนแรก", () => {
    expect([...cashflowPeriods(4, "monthly")]).toEqual([0, 1, 2, 3])
  })

  test("รายไตรมาสเกิดทุก 3 เดือนนับจากเดือนแรก", () => {
    expect([...cashflowPeriods(12, "quarterly")]).toEqual([2, 5, 8, 11])
  })

  test("EC-CMP-12 ช่วงสั้นกว่าหนึ่งงวด ไม่มีงวดเกิดเลย", () => {
    expect([...cashflowPeriods(6, "annual")]).toEqual([])
    expect(plannedTotal(plan({ frequency: "annual" }), series("2020-01", Array(6).fill(0)), RATES))
      .toEqual({ total: 0, periods: 0 })
  })
})

describe("BR-CMP-43 ผลตอบแทนต่อปีถ่วงน้ำหนักเงิน", () => {
  test("AC-CMP-24 ใส่เดือนละ 100 ผลตอบแทนเดือนละ 10% → มูลค่าสุดท้าย 331", () => {
    const result = single(series("2020-01", [0.1, 0.1]), { cashflow: plan() })

    // 100 × 1.1 = 110 บวก 100 เป็น 210 → 210 × 1.1 = 231 บวกอีก 100 ของงวดสิ้นเดือนที่ 2
    // งวดเกิดหลังผลตอบแทนของเดือนนั้นเสมอ (BR-CMP-37) จึงได้ 331
    expect(result.values.at(-1)!.value).toBeCloseTo(331, 9)
    expect(result.deposits).toEqual([100, 100])
  })

  test("AC-CMP-24 สมการ 100x² + 100x − 231 = 0 ได้ x = 1.1 พอดี", () => {
    const flows = buildFlows({
      initialAmount: 100,
      deposits: [100, 0],
      withdrawals: [0, 0],
      finalValue: 231,
    })
    // กระแสเงิน: ต้นช่วง −100 · สิ้นเดือน 1 −100 · สิ้นเดือน 2 +231
    expect(flows).toEqual([
      { month: 0, value: -100 },
      { month: 1, value: -100 },
      { month: 2, value: 231 },
    ])
    // อัตราต่อเดือน 10% → รายปี 1.1^12 − 1
    expect(moneyWeightedReturn(flows)).toBeCloseTo(1.1 ** 12 - 1, 9)
  })

  test("AC-CMP-23 ใส่เงินก่อนเดือนที่แย่ → เงินโต 0% ขณะที่พอร์ตโต 20%", () => {
    const returns = series("2020-01", [0.5, -0.2])
    const result = single(returns, { cashflow: plan() })

    // 100 × 1.5 = 150 บวก 100 เป็น 250 → 250 × 0.8 = 200 บวกอีก 100 ของงวดสิ้นเดือนที่ 2
    expect(result.values.at(-1)!.value).toBeCloseTo(300, 9)
    // ผลตอบแทนของพอร์ตยังเป็น 1.5 × 0.8 − 1 = +20%
    expect(result.returns[0].value).toBeCloseTo(0.5, 12)
    expect(result.returns[1].value).toBeCloseTo(-0.2, 12)

    const flows = buildFlows({
      initialAmount: 100,
      deposits: [100, 0],
      withdrawals: [0, 0],
      finalValue: 200,
    })
    // −100 − 100/(1+r) + 200/(1+r)² = 0 → r = 0 พอดี
    expect(moneyWeightedReturn(flows)).toBeCloseTo(0, 9)
  })

  test("BR-CMP-48 ไม่มีเงินเข้าออก → เท่ากับผลตอบแทนต่อปีแบบทบต้นทุกหลัก", () => {
    const returns = series("2020-01", [0.02, -0.01, 0.03, 0.015, -0.005, 0.01])
    const result = single(returns)
    const flows = buildFlows({
      initialAmount: 100,
      deposits: returns.map(() => 0),
      withdrawals: returns.map(() => 0),
      finalValue: result.values.at(-1)!.value,
    })

    expect(moneyWeightedReturn(flows)).toBeCloseTo(cagr(returns)!, 9)
  })

  test("BR-CMP-45 กระแสเงินไม่เปลี่ยนเครื่องหมาย → ไม่มีค่า ไม่ใช่ 0", () => {
    // ถอนจนหมด มูลค่าสุดท้ายเป็น 0 → มีแต่เงินออกจากพอร์ต ไม่มีเงินกลับเข้ากระเป๋าตอนจบ
    expect(
      moneyWeightedReturn([
        { month: 0, value: -100 },
        { month: 1, value: -50 },
        { month: 2, value: 0 },
      ]),
    ).toBeNull()
    expect(moneyWeightedReturn([{ month: 0, value: -100 }])).toBeNull()
  })

  test("ให้ผลเท่าเดิมทุกครั้งสำหรับข้อมูลชุดเดิม (BR-CMP-44)", () => {
    const flows = buildFlows({
      initialAmount: 100,
      deposits: [10, 20, 30],
      withdrawals: [0, 0, 0],
      finalValue: 200,
    })
    expect(moneyWeightedReturn(flows)).toBe(moneyWeightedReturn(flows))
  })
})

describe("BR-CMP-49 งวดที่เพิ่มตามเงินเฟ้อ", () => {
  test("AC-CMP-28 จำนวนของแต่ละปีเพิ่มตามอัตราของปีก่อนหน้า", () => {
    const indexed = plan({ inflationAdjusted: true, amount: 1000 })
    const rate2021 = RATES.find((r) => r.year === 2021)!.value
    const rate2022 = RATES.find((r) => r.year === 2022)!.value

    expect(plannedAmount(indexed, 2021, 2021, RATES)).toBe(1000)
    expect(plannedAmount(indexed, 2022, 2021, RATES)).toBeCloseTo(1000 * (1 + rate2021), 9)
    expect(plannedAmount(indexed, 2023, 2021, RATES)).toBeCloseTo(
      1000 * (1 + rate2021) * (1 + rate2022),
      9,
    )
    // ปี 2022 เงินเฟ้อพุ่ง งวดของปี 2023 จึงเพิ่มขึ้นมากกว่าปีก่อนหน้าชัดเจน
    expect(rate2022).toBeGreaterThan(0.06)
  })

  test("EC-CMP-16 ปีที่ยังไม่มีดัชนีถือว่าเงินเฟ้อเป็นศูนย์", () => {
    const indexed = plan({ inflationAdjusted: true, amount: 500 })
    expect(RATES.some((r) => r.year === 2026)).toBe(false)
    expect(plannedAmount(indexed, 2027, 2026, RATES)).toBe(500)
  })

  test("ปิดตัวเลือกแล้วจำนวนคงที่ทุกปี", () => {
    expect(plannedAmount(plan({ amount: 200 }), 2025, 2015, RATES)).toBe(200)
  })
})

describe("BR-CMP-50 ถอนจนพอร์ตหมด", () => {
  test("AC-CMP-27 ถอนได้เท่าที่มี แล้วรายงานเดือนที่หมด", () => {
    // ผลตอบแทน 0% ทุกเดือน ถอนเดือนละ 40 จากเงินตั้งต้น 100 → หมดในเดือนที่ 3
    const result = single(series("2020-01", [0, 0, 0, 0]), {
      cashflow: plan({ direction: "withdraw", amount: 40 }),
    })

    expect(result.withdrawals).toEqual([40, 40, 20, 0])
    expect(result.values.map((p) => p.value)).toEqual([100, 60, 20, 0, 0])
    expect(result.depletedAt).toBe("2020-03")
  })

  test("EC-CMP-15 ถอนเป็นเปอร์เซ็นต์ 100% ตั้งแต่งวดแรก", () => {
    const result = single(series("2020-01", [0, 0]), {
      cashflow: plan({ direction: "withdraw", basis: "percent", amount: 100 }),
    })

    expect(result.depletedAt).toBe("2020-01")
    expect(result.values.at(-1)!.value).toBe(0)
  })

  test("ค่าอื่นยังคำนวณตามปกติหลังพอร์ตหมด", () => {
    const result = single(series("2020-01", [0.05, 0.05, 0.05]), {
      cashflow: plan({ direction: "withdraw", amount: 1000 }),
    })

    // ชุดผลตอบแทนไม่ถูกแตะ แม้มูลค่าจะเป็นศูนย์ไปแล้ว
    for (const monthly of result.returns) expect(monthly.value).toBeCloseTo(0.05, 12)
  })
})

describe("PD-016 วิธีกระจายเงินที่ใส่เพิ่ม", () => {
  // A ขึ้น 100% เดือนแรก · B ขึ้น 100% เดือนที่สอง — เคสเดียวกับที่อธิบายไว้ใน PD-016
  const assets = [
    { symbol: "A", weight: 50, returns: series("2020-01", [1, 0]) },
    { symbol: "B", weight: 50, returns: series("2020-01", [0, 1]) },
  ]
  const lumpSum = portfolioReturns(assets, { rebalance: "none", initialAmount: 100 })

  test("BR-CMP-59 กระจายตามสัดส่วนที่ถืออยู่ → ชุดผลตอบแทนไม่ขยับเลย", () => {
    const dca = portfolioReturns(assets, {
      rebalance: "none",
      initialAmount: 100,
      cashflow: plan({ allocation: "prorata" }),
    })

    // ★ ข้อพิสูจน์หลัก: ชุดผลตอบแทนเท่ากันทุกหลัก แม้เงินที่ใส่จะต่างกันคนละก้อน
    expect(dca.returns.map((r) => r.value)).toEqual(lumpSum.returns.map((r) => r.value))
    // ลงทีเดียว: 100 → 150 → 200 · ทยอย: 150 บวก 100 เป็น 250 → ×4/3 = 333.33 บวกอีก 100
    expect(lumpSum.values.at(-1)!.value).toBeCloseTo(200, 9)
    expect(dca.values.at(-1)!.value).toBeCloseTo(1300 / 3, 9)
  })

  test("BR-CMP-59 กระจายตามน้ำหนักเป้าหมาย → ชุดผลตอบแทนเปลี่ยน เพราะเป็นการปรับสมดุลไปในตัว", () => {
    const dca = portfolioReturns(assets, {
      rebalance: "none",
      initialAmount: 100,
      cashflow: plan({ allocation: "target" }),
    })

    // เดือน 1 เหมือนกัน (+50%) แต่เดือน 2 ต่างกัน เพราะเงินก้อนใหม่ถูกดึงกลับเป็น 50/50
    expect(dca.returns[0].value).toBeCloseTo(0.5, 9)
    expect(lumpSum.returns[1].value).toBeCloseTo(1 / 3, 9)
    expect(dca.returns[1].value).toBeCloseTo(0.4, 9)
    // A 100 B 50 → ใส่ 100 แบบ 50/50 ได้ A 150 B 100 → เดือน 2 B เป็น 200 รวม 350 บวกอีก 100
    expect(dca.values.at(-1)!.value).toBeCloseTo(450, 9)
  })
})
