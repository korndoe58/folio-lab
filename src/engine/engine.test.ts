import { describe, expect, test } from "vitest"
import downonly from "@/data/fixtures/downonly.json"
import rf from "@/data/fixtures/rf.json"
import uponly from "@/data/fixtures/uponly.json"
import { toYearMonth, type MonthlyReturn } from "@/types/series"
import {
  annualReturns,
  annualizedStdev,
  bestWorstFullYears,
  cagr,
  commonRange,
  drawdownPeriods,
  endBalance,
  growthSeries,
  maxDrawdown,
  portfolioReturns,
  sharpe,
  sortino,
  underwaterSeries,
} from "./index"

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

describe("US-04 น้ำหนักลอยและการปรับสมดุล", () => {
  test("AC-ENG-05 น้ำหนักไม่คงที่หลังเดือนแรก", () => {
    // A +10%, B −10% ในเดือนแรก → มูลค่าเป็น 0.55 กับ 0.45 ของทุน (น้ำหนักไม่ใช่ 50/50 อีกแล้ว)
    // เดือนที่สอง A +0%, B +10% → ผลตอบแทนพอร์ต = 0.45 × 10% = 4.5%
    const result = portfolioReturns(
      [
        { symbol: "A", weight: 50, returns: series("2024-01", [0.1, 0]) },
        { symbol: "B", weight: 50, returns: series("2024-01", [-0.1, 0.1]) },
      ],
      { rebalance: "annual" },
    )

    expect(result.returns[0].value).toBeCloseTo(0, 12)
    expect(result.returns[1].value).toBeCloseTo(0.045, 12)
  })

  test("AC-ENG-06 น้ำหนักถูกดึงกลับเป็นเป้าหมายหลังสิ้นเดือนธันวาคม", () => {
    // ธ.ค. 2024: A +10%, B −10% → ถ้าไม่ปรับสมดุล ม.ค. จะได้ 4.5% เหมือนข้างบน
    // แต่ปรับสมดุลแล้วกลับเป็น 50/50 → ม.ค. ได้ 0.5 × 10% = 5%
    const result = portfolioReturns(
      [
        { symbol: "A", weight: 50, returns: series("2024-12", [0.1, 0]) },
        { symbol: "B", weight: 50, returns: series("2024-12", [-0.1, 0.1]) },
      ],
      { rebalance: "annual" },
    )

    expect(result.returns[1].month).toBe("2025-01")
    expect(result.returns[1].value).toBeCloseTo(0.05, 12)
  })

  test("ปิดการปรับสมดุลแล้วน้ำหนักลอยข้ามปี", () => {
    const result = portfolioReturns(
      [
        { symbol: "A", weight: 50, returns: series("2024-12", [0.1, 0]) },
        { symbol: "B", weight: 50, returns: series("2024-12", [-0.1, 0.1]) },
      ],
      { rebalance: "none" },
    )

    expect(result.returns[1].value).toBeCloseTo(0.045, 12)
  })
})

describe("US-04 ช่วงร่วมของสินทรัพย์ต่างวัย", () => {
  test("AC-ENG-08 ใช้เฉพาะช่วงที่ทุกตัวมีข้อมูล และรายงานตัวจำกัด", () => {
    const result = portfolioReturns([
      { symbol: "OLD", weight: 50, returns: series("2010-01", Array(120).fill(0.01)) },
      { symbol: "NEW", weight: 50, returns: series("2015-01", Array(60).fill(0.01)) },
    ])

    expect(result.usedRange).toEqual({ start: "2015-01", end: "2019-12" })
    expect(result.returns).toHaveLength(60)
    expect(result.limitedBy).toContain("NEW")
  })

  test("ไม่มีเดือนที่ทับกันเลย คืนผลว่างพร้อมบอกว่าคำนวณไม่ได้", () => {
    const result = portfolioReturns([
      { symbol: "A", weight: 50, returns: series("2010-01", [0.01, 0.01]) },
      { symbol: "B", weight: 50, returns: series("2020-01", [0.01, 0.01]) },
    ])

    expect(result.usedRange).toBeNull()
    expect(result.returns).toEqual([])
  })
})

describe("US-04 ช่วงขาดทุนและการฟื้น", () => {
  test("AC-ENG-07 ยังไม่ฟื้นจนจบข้อมูล รายงานว่าไม่มีเดือนที่ฟื้น", () => {
    const result = portfolioReturns([
      { symbol: "DOWNONLY", weight: 100, returns: downonly.returns },
    ])
    const worst = maxDrawdown(result.returns)

    expect(worst).not.toBeNull()
    expect(worst?.recoveredAt, "ต้องเป็น null ไม่ใช่ 0 เดือน").toBeNull()
    expect(worst?.recoveryMonths).toBeNull()
    expect(worst?.depth).toBeLessThan(0)
  })

  test("เวลาฟื้นนับจากเดือนถัดจากจุดต่ำสุดถึงเดือนที่กลับมาเท่าเดิม", () => {
    // ขึ้น 10% แล้วลง 20% (ต่ำสุด) แล้วขึ้นกลับมาเกินจุดเดิมในสองเดือน
    const returns = series("2024-01", [0.1, -0.2, 0.13, 0.13])
    const worst = maxDrawdown(returns)

    expect(worst?.start).toBe("2024-02")
    expect(worst?.trough).toBe("2024-02")
    expect(worst?.lengthMonths).toBe(1)
    expect(worst?.recoveredAt).toBe("2024-04")
    expect(worst?.recoveryMonths).toBe(2)
  })

  test("ความลึกเท่ากันเรียงตามเวลาที่เกิดก่อน และเรียงเหมือนเดิมทุกครั้ง", () => {
    const returns = series("2024-01", [-0.1, 0.2, -0.1, 0.2])
    const first = drawdownPeriods(returns)
    const second = drawdownPeriods(returns)

    expect(first.map((p) => p.start)).toEqual(second.map((p) => p.start))
    expect(first[0].depth).toBeCloseTo(first[1].depth, 12)
    expect(first[0].start < first[1].start).toBe(true)
  })

  test("ไม่เคยต่ำกว่าจุดสูงสุดเลย ไม่มีช่วงขาดทุน", () => {
    const result = portfolioReturns([{ symbol: "UPONLY", weight: 100, returns: uponly.returns }])

    expect(drawdownPeriods(result.returns)).toEqual([])
    expect(maxDrawdown(result.returns)).toBeNull()
  })

  test("สัดส่วนที่ต่ำกว่าจุดสูงสุดเป็น 0 เมื่ออยู่ที่จุดสูงสุด", () => {
    const points = underwaterSeries(series("2024-01", [0.1, -0.1, 0.2]))

    expect(points[0].value).toBeCloseTo(0, 12)
    expect(points[1].value).toBeCloseTo(-0.1, 12)
    expect(points[2].value).toBeCloseTo(0, 12)
  })
})

describe("US-04 ค่าที่คำนวณไม่ได้ต้องไม่เป็นศูนย์", () => {
  test("AC-ENG-09 ไม่มีเดือนติดลบเลย Sortino ไม่มีค่า", () => {
    const result = portfolioReturns([{ symbol: "UPONLY", weight: 100, returns: uponly.returns }])

    expect(sortino(result.returns, [])).toBeNull()
    expect(sharpe(result.returns, [])).not.toBeNull()
  })

  test("EC-ENG-02 ข้อมูลเดือนเดียว ค่าที่ต้องใช้หลายเดือนไม่มีค่า", () => {
    const one = series("2024-01", [0.05])

    expect(annualizedStdev(one)).toBeNull()
    expect(sharpe(one, [])).toBeNull()
    expect(sortino(one, [])).toBeNull()
    expect(maxDrawdown(one)).toBeNull()
    // มูลค่าสุดท้ายยังคำนวณได้
    expect(endBalance(one, 10_000)).toBeCloseTo(10_500, 6)
    expect(cagr(one)).not.toBeNull()
  })

  test("ไม่มีข้อมูลเลย ทุกค่าไม่มีค่า", () => {
    expect(cagr([])).toBeNull()
    expect(annualizedStdev([])).toBeNull()
    expect(bestWorstFullYears(annualReturns([]))).toEqual({ best: null, worst: null })
  })
})

describe("US-04 กรณีขอบอื่น ๆ", () => {
  test("EC-ENG-01 สินทรัพย์ตัวเดียว ผลตอบแทนพอร์ตเท่ากับของสินทรัพย์นั้น", () => {
    const only = series("2024-01", [0.03, -0.02, 0.05])
    const result = portfolioReturns([{ symbol: "A", weight: 100, returns: only }])

    result.returns.forEach((r, i) => expect(r.value).toBeCloseTo(only[i].value, 12))
  })

  test("EC-ENG-03 ช่วงสั้นกว่าหนึ่งปี ยังคำนวณผลตอบแทนต่อปีได้ และปีนั้นเป็นปีไม่เต็ม", () => {
    const short = series("2024-01", [0.02, 0.02, 0.02])

    expect(cagr(short)).toBeGreaterThan(0)
    expect(annualReturns(short)[0].partial).toBe(true)
  })

  test("EC-ENG-04 ขาดทุนตลอดช่วง Sharpe ติดลบได้ ไม่ถูกตัดเป็นศูนย์", () => {
    const losing = series("2024-01", Array(24).fill(-0.01))

    expect(sharpe(losing, [])).toBeLessThan(0)
    expect(cagr(losing)).toBeLessThan(0)
  })

  test("EC-ENG-06 น้ำหนัก 0% ไม่มีผลและไม่ทำให้การคำนวณล้ม", () => {
    const withZero = portfolioReturns([
      { symbol: "A", weight: 100, returns: series("2024-01", [0.05, 0.05]) },
      { symbol: "B", weight: 0, returns: series("2024-01", [-0.9, -0.9]) },
    ])

    withZero.returns.forEach((r) => expect(r.value).toBeCloseTo(0.05, 12))
  })

  test("น้ำหนักรวมไม่เท่ากับ 100 พอดี ถูก normalize ให้รวมเป็นหนึ่ง", () => {
    const raw = portfolioReturns([
      { symbol: "A", weight: 33.34, returns: series("2024-01", [0.06]) },
      { symbol: "B", weight: 33.33, returns: series("2024-01", [0.06]) },
      { symbol: "C", weight: 33.33, returns: series("2024-01", [0.06]) },
    ])

    expect(raw.returns[0].value).toBeCloseTo(0.06, 12)
  })

  test("AC-ENG-10 คำนวณซ้ำได้ผลเท่าเดิมทุกค่า", () => {
    const assets = [
      { symbol: "A", weight: 60, returns: series("2020-01", Array(48).fill(0.01)) },
      { symbol: "B", weight: 40, returns: series("2020-01", Array(48).fill(-0.002)) },
    ]
    const first = portfolioReturns(assets)
    const second = portfolioReturns(assets)

    expect(second.returns).toEqual(first.returns)
    expect(sharpe(second.returns, rf.returns)).toBe(sharpe(first.returns, rf.returns))
    expect(drawdownPeriods(second.returns)).toEqual(drawdownPeriods(first.returns))
  })

  test("เส้นมูลค่าเริ่มที่จุดตั้งต้นก่อนเดือนแรก แล้วคูณทุกเดือนรวมเดือนแรก", () => {
    const points = growthSeries(series("2024-01", [0.1, 0.1]), 100)

    expect(points[0]).toEqual({ month: null, value: 100 })
    expect(points[1].month).toBe("2024-01")
    expect(points[1].value).toBeCloseTo(110, 10)
    expect(points[2].value).toBeCloseTo(121, 10)
  })
})

describe("US-19 วิธีปรับสมดุลพอร์ต", () => {
  /** 50/50 ที่เดือนแรกตัวหนึ่ง +10% อีกตัว −10% แล้วเดือนถัดมาทั้งคู่ 0% */
  const drifting = [
    { symbol: "A", weight: 50, returns: series("2024-01", [0.1, 0, 0]) },
    { symbol: "B", weight: 50, returns: series("2024-01", [-0.1, 0, 0]) },
  ]

  test("AC-CMP-36 ปรับรายเดือน ดึงน้ำหนักกลับ 50/50 ทุกสิ้นเดือน", () => {
    const result = portfolioReturns(drifting, { rebalance: "monthly" })

    expect(result.returns[0].value).toBeCloseTo(0, 12)
    // เดือนที่สองทั้งคู่ 0% และน้ำหนักถูกดึงกลับแล้ว ผลจึงเป็น 0 พอดี
    expect(result.returns[1].value).toBeCloseTo(0, 12)
    expect(result.rebalanceCount).toBe(3)
  })

  test("AC-CMP-37 ไม่ปรับ น้ำหนักลอยเป็น 55/45 และไม่มีการปรับเลย", () => {
    const result = portfolioReturns(drifting, { rebalance: "none" })
    expect(result.rebalanceCount).toBe(0)

    // พิสูจน์ว่าน้ำหนักลอยจริง: เดือนถัดไปให้ A +10% อีกครั้ง ผลต้องเป็น 0.55 × 10% = 5.5%
    const driftedThenUp = [
      { symbol: "A", weight: 50, returns: series("2024-01", [0.1, 0.1]) },
      { symbol: "B", weight: 50, returns: series("2024-01", [-0.1, 0]) },
    ]
    const floated = portfolioReturns(driftedThenUp, { rebalance: "none" })
    expect(floated.returns[1].value).toBeCloseTo(0.055, 12)

    // ปรับรายเดือนแล้วน้ำหนักกลับเป็น 50/50 ผลจึงเป็น 0.5 × 10% = 5%
    const rebalanced = portfolioReturns(driftedThenUp, { rebalance: "monthly" })
    expect(rebalanced.returns[1].value).toBeCloseTo(0.05, 12)
  })

  test("BR-CMP-55 รอบการปรับอิงปฏิทิน ไม่ใช่นับจากเดือนแรกของช่วง", () => {
    const twoYears = [
      { symbol: "A", weight: 50, returns: series("2024-02", Array(24).fill(0.01)) },
      { symbol: "B", weight: 50, returns: series("2024-02", Array(24).fill(-0.01)) },
    ]

    // ก.พ. 2024 ถึง ม.ค. 2026 → ธ.ค. สองครั้ง
    expect(portfolioReturns(twoYears, { rebalance: "annual" }).rebalanceCount).toBe(2)
    // มี.ค./มิ.ย./ก.ย./ธ.ค. ของสองปี = 8 ครั้ง
    expect(portfolioReturns(twoYears, { rebalance: "quarterly" }).rebalanceCount).toBe(8)
    expect(portfolioReturns(twoYears, { rebalance: "monthly" }).rebalanceCount).toBe(24)
  })

  test("EC-CMP-20 ช่วงที่ไม่มีเดือนธันวาคมเลย ตั้งรายปีแล้วไม่มีการปรับ", () => {
    const halfYear = [
      { symbol: "A", weight: 50, returns: series("2024-01", Array(6).fill(0.01)) },
      { symbol: "B", weight: 50, returns: series("2024-01", Array(6).fill(-0.01)) },
    ]
    expect(portfolioReturns(halfYear, { rebalance: "annual" }).rebalanceCount).toBe(0)
  })

  test("AC-CMP-38 แบบเบี่ยงเบนปรับเฉพาะเดือนที่ออกนอกช่วง และน้อยกว่ารายเดือน", () => {
    const volatile = [
      { symbol: "A", weight: 50, returns: series("2024-01", Array(12).fill(0.03)) },
      { symbol: "B", weight: 50, returns: series("2024-01", Array(12).fill(-0.03)) },
    ]

    const bands = portfolioReturns(volatile, { rebalance: "bands", bandPoints: 5 })
    const monthly = portfolioReturns(volatile, { rebalance: "monthly" })

    expect(bands.rebalanceCount).toBeGreaterThan(0)
    expect(bands.rebalanceCount).toBeLessThan(monthly.rebalanceCount)
  })

  test("EC-CMP-18/19 เกณฑ์กว้างไม่ปรับเลย เกณฑ์แคบปรับถี่", () => {
    // A โต 2% ทุกเดือน B อยู่นิ่ง → น้ำหนักห่างจากเป้าราว 0.5 จุดต่อเดือน
    const mild = [
      { symbol: "A", weight: 50, returns: series("2024-01", Array(12).fill(0.02)) },
      { symbol: "B", weight: 50, returns: series("2024-01", Array(12).fill(0)) },
    ]

    expect(portfolioReturns(mild, { rebalance: "bands", bandPoints: 50 }).rebalanceCount).toBe(0)
    expect(
      portfolioReturns(mild, { rebalance: "bands", bandPoints: 1 }).rebalanceCount,
    ).toBeGreaterThan(0)
  })

  test("AC-CMP-40 พอร์ตสินทรัพย์เดียว ทุกวิธีให้ผลเท่ากัน", () => {
    const solo = [{ symbol: "A", weight: 100, returns: series("2024-01", [0.05, -0.02, 0.03]) }]
    const modes = ["none", "monthly", "quarterly", "annual", "bands"] as const

    const results = modes.map((rebalance) =>
      portfolioReturns(solo, { rebalance, bandPoints: 5 }).returns.map((r) => r.value),
    )
    for (const values of results) expect(values).toEqual(results[0])
  })

  test("AC-CMP-43 ค่าปริยายยังเป็นรายปี ผลจึงเท่ากับก่อนมีการ์ดนี้", () => {
    expect(portfolioReturns(drifting).returns).toEqual(
      portfolioReturns(drifting, { rebalance: "annual" }).returns,
    )
  })
})

describe("BR-ENG-14 ตัวที่จำกัดต้นช่วงกับตัวที่จำกัดท้ายช่วง", () => {
  const span = (symbol: string, from: string, count: number) => ({
    symbol,
    returns: Array.from({ length: count }, (_, i) => {
      const [y, m] = from.split("-").map(Number)
      const zero = (y * 12 + (m - 1)) + i
      return { month: toYearMonth(Math.floor(zero / 12), (zero % 12) + 1), value: 0.01 }
    }),
  })

  test("ตัวที่ข้อมูลเริ่มช้าเป็นตัวจำกัดต้นช่วง ไม่ใช่ตัวที่จบท้ายช่วงพอดี", () => {
    // ยาว: 2012-01 ถึง 2026-06 · สั้น: 2014-10 ถึง 2026-06
    const shared = commonRange([span("VTI", "2012-01", 174), span("BTC-USD", "2014-10", 141)])!

    expect(shared.range).toEqual({ start: "2014-10", end: "2026-06" })
    // ★ ต้นช่วงถูกจำกัดโดยตัวสั้นเท่านั้น แม้ตัวยาวจะจบท้ายช่วงพอดีก็ตาม
    expect(shared.limitedStartBy).toEqual(["BTC-USD"])
    // ท้ายช่วงจบพร้อมกันทั้งคู่
    expect(shared.limitedEndBy).toEqual(["VTI", "BTC-USD"])
    // ของเดิมยังรวมทั้งสองแบบไว้เหมือนเดิม ไม่ทำสัญญาเก่าพัง
    expect(shared.limitedBy).toContain("VTI")
    expect(shared.limitedBy).toContain("BTC-USD")
  })

  test("ตัวที่จบเร็วเป็นตัวจำกัดท้ายช่วง", () => {
    const shared = commonRange([span("A", "2012-01", 174), span("B", "2012-01", 100)])!

    expect(shared.limitedStartBy).toEqual(["A", "B"])
    expect(shared.limitedEndBy).toEqual(["B"])
  })
})
