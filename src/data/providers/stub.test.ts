import { describe, expect, test } from "vitest"
import { createStubProvider, STUB_LAST_CLOSED_MONTH } from "./stub"

const FULL_RANGE = { start: "2012-01", end: "2026-06" }

describe("US-03 ชุดข้อมูลจำลอง", () => {
  const stub = createStubProvider()

  test("AC-CCH-06 ทำงานแบบไม่ต้องต่อเน็ต และเรียกซ้ำได้ค่าเดียวกันทุกตัว", async () => {
    const first = await stub.getMonthlySeries("VTI", FULL_RANGE)
    const second = await stub.getMonthlySeries("VTI", FULL_RANGE)

    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.series.returns).toEqual(first.series.returns)
    expect(first.series.returns).toHaveLength(174)
    expect(first.series.actualRange).toEqual({ start: "2012-01", end: "2026-06" })
  })

  test("AC-CCH-07 สัญลักษณ์ที่กำหนดให้ไม่พบ ตอบเหมือนแหล่งข้อมูลจริง", async () => {
    const result = await stub.getMonthlySeries("ZZZZZ", FULL_RANGE)

    expect(result).toEqual({ ok: false, failure: { kind: "symbol-not-found", symbol: "ZZZZZ" } })
  })

  test("AC-CCH-08 สัญลักษณ์ที่ข้อมูลสั้นกว่าช่วงที่ขอ คืนเท่าที่มีพร้อมช่วงจริง", async () => {
    const result = await stub.getMonthlySeries("NEWFUND", FULL_RANGE)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.series.actualRange?.start).toBe("2020-01")
    expect(result.series.returns.some((r) => r.month < "2020-01")).toBe(false)
  })

  test("AC-CCH-09 สัญลักษณ์ที่จำลองการติดต่อไม่ได้ ตอบชนิดติดต่อไม่ได้ทุกครั้ง", async () => {
    for (let i = 0; i < 3; i++) {
      const result = await stub.getMonthlySeries("ERRNET", FULL_RANGE)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.failure.kind).toBe("unreachable")
    }
  })

  test("ชุดอ้างอิงครบทุกสัญลักษณ์ที่ golden test ต้องใช้", async () => {
    for (const symbol of ["VTI", "VNQ", "VXUS", "BND", "SPY", "RF"]) {
      const result = await stub.getMonthlySeries(symbol, FULL_RANGE)
      expect(result.ok, `${symbol} ต้องมีในชุดข้อมูลจำลอง`).toBe(true)
      if (result.ok) {
        expect(result.series.returns, `${symbol} ต้องครบ 174 เดือน`).toHaveLength(174)
        expect(result.series.returns.every((r) => Number.isFinite(r.value))).toBe(true)
      }
    }
  })

  test("fixture พิเศษมีพฤติกรรมตามที่การ์ดปลายน้ำต้องใช้", async () => {
    const upOnly = await stub.getMonthlySeries("UPONLY", FULL_RANGE)
    expect(upOnly.ok && upOnly.series.returns.every((r) => r.value > 0)).toBe(true)

    const downOnly = await stub.getMonthlySeries("DOWNONLY", FULL_RANGE)
    if (!downOnly.ok) throw new Error("DOWNONLY ต้องมีข้อมูล")
    // ขึ้นก่อนแล้วลงยาวจนจบ — มูลค่าปลายทางต้องต่ำกว่าจุดสูงสุดที่เคยทำได้
    let value = 1
    let peak = 1
    for (const r of downOnly.series.returns) {
      value *= 1 + r.value
      peak = Math.max(peak, value)
    }
    expect(value).toBeLessThan(peak)
  })

  test("ไม่พึ่งเวลาปัจจุบัน เดือนล่าสุดตรึงไว้", () => {
    expect(stub.lastClosedMonth()).toBe(STUB_LAST_CLOSED_MONTH)
  })
})
