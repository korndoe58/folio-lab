import { describe, expect, it } from "vitest"
import type { MonthRange, MonthlyReturn, PriceProvider, SeriesResult } from "@/types/series"
import { loadPortfolioSeries } from "./load-portfolio"

const RANGE: MonthRange = { start: "2020-01", end: "2020-03" }

function series(values: number[]): MonthlyReturn[] {
  return values.map((value, i) => ({ month: `2020-0${i + 1}`, value }))
}

/** provider ปลอมที่บันทึกว่าถูกเรียกด้วยสัญลักษณ์อะไรบ้าง เพื่อพิสูจน์กฎ BR-FX-06 */
function fakeProvider(table: Record<string, MonthlyReturn[] | "not-found" | "unreachable">) {
  const calls: string[] = []
  const provider: PriceProvider = {
    lastClosedMonth: () => "2020-03",
    async getMonthlySeries(symbol: string): Promise<SeriesResult> {
      calls.push(symbol)
      const entry = table[symbol]
      if (entry === undefined || entry === "not-found") {
        return { ok: false, failure: { kind: "symbol-not-found", symbol } }
      }
      if (entry === "unreachable") {
        return { ok: false, failure: { kind: "unreachable", symbol, sourcesTried: 2 } }
      }
      return {
        ok: true,
        series: { symbol, returns: entry, actualRange: RANGE, source: "stub" },
      }
    },
  }
  return { provider, calls }
}

describe("loadPortfolioSeries — พอร์ตสกุลเดียว (AC-FX-03, BR-FX-06)", () => {
  it("พอร์ตดอลลาร์ล้วน ฐานดอลลาร์ ต้องไม่เรียกอัตราแลกเปลี่ยนเลย", async () => {
    const { provider, calls } = fakeProvider({
      VTI: series([0.1, 0.02, -0.01]),
      BND: series([0.01, 0.0, 0.005]),
      SPY: series([0.09, 0.03, -0.02]),
    })

    const result = await loadPortfolioSeries({
      provider,
      symbols: ["VTI", "BND"],
      benchmark: "SPY",
      range: RANGE,
      base: "USD",
    })

    expect(result.ok).toBe(true)
    expect(calls).toEqual(["VTI", "BND", "SPY"])
    expect(calls).not.toContain("THB=X")
  })

  it("ผลตอบแทนของพอร์ตสกุลเดียวไม่ถูกแตะเลย (BR-FX-05)", async () => {
    const vti = series([0.1, 0.02, -0.01])
    const { provider } = fakeProvider({ VTI: vti, SPY: series([0.09, 0.03, -0.02]) })

    const result = await loadPortfolioSeries({
      provider,
      symbols: ["VTI"],
      benchmark: "SPY",
      range: RANGE,
      base: "USD",
    })

    expect(result.ok && result.assets[0].returns).toEqual(vti)
    expect(result.ok && result.converted).toBe(false)
  })

  it("พอร์ตหุ้นไทยล้วน ฐานเงินบาท ก็ไม่เรียกอัตราแลกเปลี่ยน (EC-FX-01)", async () => {
    const { provider, calls } = fakeProvider({
      "PTT.BK": series([0.05, 0.01, 0.02]),
      "CPALL.BK": series([0.03, -0.01, 0.04]),
    })

    await loadPortfolioSeries({
      provider,
      symbols: ["PTT.BK"],
      benchmark: "CPALL.BK",
      range: RANGE,
      base: "THB",
    })

    expect(calls).not.toContain("THB=X")
  })
})

describe("loadPortfolioSeries — พอร์ตผสมสกุลเงิน", () => {
  const mixed = {
    "PTT.BK": series([0.1, 0.1, 0.1]),
    VTI: series([0.1, 0.1, 0.1]),
    SPY: series([0.1, 0.1, 0.1]),
    "THB=X": series([0.05, 0.05, 0.05]),
  }

  it("เรียกอัตราแลกเปลี่ยนครั้งเดียว และแปลงเฉพาะตัวที่สกุลไม่ตรงฐาน", async () => {
    const { provider, calls } = fakeProvider(mixed)

    const result = await loadPortfolioSeries({
      provider,
      symbols: ["PTT.BK", "VTI"],
      benchmark: "SPY",
      range: RANGE,
      base: "USD",
    })

    expect(calls.filter((s) => s === "THB=X")).toHaveLength(1)
    if (!result.ok) throw new Error("ต้องสำเร็จ")

    // หุ้นไทยมองเป็นดอลลาร์: 1.10 ÷ 1.05 − 1 ≈ 4.76%
    expect(result.assets[0].returns[0].value).toBeCloseTo(0.047619, 6)
    // สินทรัพย์ดอลลาร์ไม่ถูกแตะ
    expect(result.assets[1].returns).toEqual(mixed.VTI)
    expect(result.converted).toBe(true)
  })

  it("AC-FX-08 ตัวเทียบถูกแปลงด้วยกติกาเดียวกัน", async () => {
    const { provider } = fakeProvider(mixed)

    const result = await loadPortfolioSeries({
      provider,
      symbols: ["PTT.BK"],
      benchmark: "SPY",
      range: RANGE,
      base: "THB",
    })

    if (!result.ok) throw new Error("ต้องสำเร็จ")
    // ตัวเทียบเป็นดอลลาร์ มองเป็นบาท: 1.10 × 1.05 − 1 = 15.5%
    expect(result.benchmark[0].value).toBeCloseTo(0.155, 10)
    // ส่วนหุ้นไทยซึ่งตรงกับฐานอยู่แล้ว ไม่ถูกแตะ
    expect(result.assets[0].returns).toEqual(mixed["PTT.BK"])
  })

  it("AC-FX-06 ดึงอัตราแลกเปลี่ยนไม่สำเร็จ ต้องล้มทั้งคำขอ ไม่คืนผลบางส่วน", async () => {
    const { provider } = fakeProvider({ ...mixed, "THB=X": "unreachable" })

    const result = await loadPortfolioSeries({
      provider,
      symbols: ["PTT.BK", "VTI"],
      benchmark: "SPY",
      range: RANGE,
      base: "USD",
    })

    expect(result).toEqual({ ok: false, reason: "fx-unreachable" })
  })
})

describe("loadPortfolioSeries — ความล้มเหลวเดิมยังแยกได้เหมือนเดิม", () => {
  it("สัญลักษณ์ที่ไม่มีข้อมูล คืนชนิดไม่พบพร้อมรายชื่อ", async () => {
    const { provider } = fakeProvider({ VTI: series([0.1]), SPY: series([0.1]) })

    const result = await loadPortfolioSeries({
      provider,
      symbols: ["VTI", "ZZZZZ"],
      benchmark: "SPY",
      range: RANGE,
      base: "USD",
    })

    expect(result).toEqual({ ok: false, reason: "symbol-not-found", symbols: ["ZZZZZ"] })
  })

  it("ติดต่อแหล่งข้อมูลไม่ได้ มาก่อนกรณีไม่พบสัญลักษณ์ เพราะลองใหม่แล้วอาจหาย", async () => {
    const { provider } = fakeProvider({ VTI: "unreachable", SPY: series([0.1]) })

    const result = await loadPortfolioSeries({
      provider,
      symbols: ["VTI", "ZZZZZ"],
      benchmark: "SPY",
      range: RANGE,
      base: "USD",
    })

    expect(result).toEqual({ ok: false, reason: "unreachable", symbols: ["VTI"] })
  })

  it("ไม่เรียกอัตราแลกเปลี่ยนเมื่อสินทรัพย์ล้มไปแล้ว", async () => {
    const { provider, calls } = fakeProvider({ "PTT.BK": "unreachable", SPY: series([0.1]) })

    await loadPortfolioSeries({
      provider,
      symbols: ["PTT.BK"],
      benchmark: "SPY",
      range: RANGE,
      base: "USD",
    })

    expect(calls).not.toContain("THB=X")
  })
})
