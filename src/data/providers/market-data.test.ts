import { beforeEach, describe, expect, test, vi } from "vitest"
import { createMemoryCache } from "@/data/cache/memory"
import type { MonthRange } from "@/types/series"
import { createMarketData, lastClosedMonthFrom, normalizeSymbol } from "./market-data"
import type { DailyRow, RawFetchResult, RawPriceSource } from "./raw-source"

const NOW = new Date("2026-07-15T00:00:00Z")
const now = () => NOW

/** ราคาที่โตเดือนละ 1% ตั้งแต่เดือนที่ระบุ ครอบคลุมถึงเดือนสุดท้ายที่ขอ */
function dailyRows(fromMonth: string, months: number, startPrice = 100): DailyRow[] {
  const rows: DailyRow[] = []
  let [year, month] = fromMonth.split("-").map(Number)
  let price = startPrice
  for (let i = 0; i < months; i++) {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    rows.push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
      adjustedClose: price,
    })
    price *= 1.01
    month++
    if (month > 12) {
      month = 1
      year++
    }
  }
  return rows
}

type FakeOptions = {
  rows?: DailyRow[]
  result?: RawFetchResult
  delayMs?: number
}

function fakeSource(name: string, options: FakeOptions = {}) {
  const calls: Array<{ symbol: string; range: MonthRange }> = []
  const source: RawPriceSource = {
    name,
    async fetchDaily(symbol, range, signal) {
      calls.push({ symbol, range })
      if (options.delayMs) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, options.delayMs)
          signal?.addEventListener("abort", () => {
            clearTimeout(timer)
            reject(new Error("aborted"))
          })
        })
      }
      if (options.result) return options.result
      return { ok: true, rows: options.rows ?? [] }
    },
  }
  return { source, calls }
}

const RANGE_2012_2026: MonthRange = { start: "2012-01", end: "2026-06" }

describe("US-01 ดึงราคาผ่านสัญญากลางพร้อมแหล่งสำรอง", () => {
  test("AC-PRV-01 ได้ผลตอบแทนครบ 174 เดือน โดยดึงราคาเผื่อเดือนฐาน", async () => {
    // ราคาต้องเริ่ม ธ.ค. 2011 เพื่อให้ ม.ค. 2012 มีผลตอบแทน (BR-PRV-10)
    const primary = fakeSource("stooq", { rows: dailyRows("2011-12", 175) })
    const md = createMarketData({ sources: [primary.source], now })

    const result = await md.getMonthlySeries("VTI", RANGE_2012_2026)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.series.returns).toHaveLength(174)
    expect(result.series.actualRange).toEqual({ start: "2012-01", end: "2026-06" })
    // ช่วงที่ยิงออกไปต้องเผื่อหนึ่งเดือนก่อนหน้า
    expect(primary.calls[0].range.start).toBe("2011-12")
  })

  test("AC-PRV-02 แหล่งหลักล้มเหลวเชิงเทคนิค ระบบใช้แหล่งสำรองโดยผู้เรียกไม่ต้องรู้", async () => {
    const primary = fakeSource("stooq", { result: { ok: false, reason: "technical" } })
    const backup = fakeSource("yahoo", { rows: dailyRows("2011-12", 175) })
    const md = createMarketData({ sources: [primary.source, backup.source], now })

    const result = await md.getMonthlySeries("VTI", RANGE_2012_2026)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.series.source).toBe("yahoo")
    expect(result.series.returns).toHaveLength(174)
  })

  test("AC-PRV-03 แหล่งหลักตอบว่าไม่พบสัญลักษณ์ ห้ามลองแหล่งสำรอง", async () => {
    const primary = fakeSource("stooq", { result: { ok: false, reason: "symbol-not-found" } })
    const backup = fakeSource("yahoo", { rows: dailyRows("2011-12", 175) })
    const md = createMarketData({ sources: [primary.source, backup.source], now })

    const result = await md.getMonthlySeries("ZZZZZ", RANGE_2012_2026)

    expect(result).toEqual({ ok: false, failure: { kind: "symbol-not-found", symbol: "ZZZZZ" } })
    expect(backup.calls).toHaveLength(0)
  })

  test("AC-PRV-04 ล้มเหลวทั้งสองแหล่ง คืนชนิดติดต่อไม่ได้พร้อมจำนวนแหล่งที่ลอง", async () => {
    const primary = fakeSource("stooq", { result: { ok: false, reason: "technical" } })
    const backup = fakeSource("yahoo", { result: { ok: false, reason: "technical" } })
    const md = createMarketData({ sources: [primary.source, backup.source], now })

    const result = await md.getMonthlySeries("VTI", RANGE_2012_2026)

    expect(result).toEqual({
      ok: false,
      failure: { kind: "unreachable", symbol: "VTI", sourcesTried: 2 },
    })
  })

  test("AC-PRV-05 ข้อมูลสั้นกว่าที่ขอ ผลตอบแทนเริ่มเดือนที่สองของข้อมูล", async () => {
    // มีราคาตั้งแต่ ก.พ. 2011 → ผลตอบแทนเริ่ม มี.ค. 2011
    const primary = fakeSource("stooq", { rows: dailyRows("2011-02", 180) })
    const md = createMarketData({ sources: [primary.source], now })

    const result = await md.getMonthlySeries("VXUS", { start: "2000-01", end: "2026-06" })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.series.actualRange?.start).toBe("2011-03")
    expect(result.series.returns.some((r) => r.month < "2011-03")).toBe(false)
  })

  test("AC-PRV-06 คำขอพร้อมกันห้าครั้ง ยิงออกครั้งเดียว", async () => {
    const primary = fakeSource("stooq", { rows: dailyRows("2011-12", 175), delayMs: 5 })
    const md = createMarketData({ sources: [primary.source], now })

    const results = await Promise.all(
      Array.from({ length: 5 }, () => md.getMonthlySeries("BND", RANGE_2012_2026)),
    )

    expect(primary.calls).toHaveLength(1)
    for (const result of results) {
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.series.returns).toHaveLength(174)
    }
  })

  test("AC-PRV-07 แหล่งหลักช้าเกินกำหนด ระบบเลิกรอแล้วใช้แหล่งสำรอง", async () => {
    const primary = fakeSource("stooq", { rows: dailyRows("2011-12", 175), delayMs: 50 })
    const backup = fakeSource("yahoo", { rows: dailyRows("2011-12", 175) })
    const md = createMarketData({
      sources: [primary.source, backup.source],
      now,
      timeoutMs: 10,
    })

    const result = await md.getMonthlySeries("VTI", RANGE_2012_2026)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.series.source).toBe("yahoo")
  })

  test("AC-PRV-08 สัญลักษณ์ถูกจัดรูปแบบก่อนใช้", async () => {
    const primary = fakeSource("stooq", { rows: dailyRows("2011-12", 175) })
    const md = createMarketData({ sources: [primary.source], now })

    const result = await md.getMonthlySeries("  vti  ", RANGE_2012_2026)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.series.symbol).toBe("VTI")
    expect(primary.calls[0].symbol).toBe("VTI")
  })

  test("EC-PRV-01 สัญลักษณ์ผิดรูปแบบ คืนไม่พบทันทีโดยไม่เรียกออกไปข้างนอก", async () => {
    const primary = fakeSource("stooq", { rows: dailyRows("2011-12", 175) })
    const md = createMarketData({ sources: [primary.source], now })

    for (const bad of ["VT I", "!!!", "", "TOOLONGSYMBOL"]) {
      const result = await md.getMonthlySeries(bad, RANGE_2012_2026)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.failure.kind).toBe("symbol-not-found")
    }
    expect(primary.calls).toHaveLength(0)
  })

  test("EC-PRV-02 ตอบสำเร็จแต่รายการว่าง ถือเป็นล้มเหลวเชิงเทคนิค ลองแหล่งถัดไป", async () => {
    const primary = fakeSource("stooq", { rows: [] })
    const backup = fakeSource("yahoo", { rows: dailyRows("2011-12", 175) })
    const md = createMarketData({ sources: [primary.source, backup.source], now })

    const result = await md.getMonthlySeries("VTI", RANGE_2012_2026)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.series.source).toBe("yahoo")
  })

  test("EC-PRV-04 ช่วงที่ขอเลยเดือนที่ปิดแล้ว ถูกตัดที่เดือนล่าสุดที่ปิด", async () => {
    const primary = fakeSource("stooq", { rows: dailyRows("2011-12", 175) })
    const md = createMarketData({ sources: [primary.source], now })

    const result = await md.getMonthlySeries("VTI", { start: "2012-01", end: "2030-12" })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.series.actualRange?.end).toBe("2026-06")
  })

  test("lastClosedMonth คำนวณจากปฏิทินโดยไม่เรียกแหล่งข้อมูล (BR-PRV-11)", () => {
    const md = createMarketData({ sources: [], now })
    expect(md.lastClosedMonth()).toBe("2026-06")
    expect(lastClosedMonthFrom(new Date("2026-01-05T00:00:00Z"))).toBe("2025-12")
  })

  test("normalizeSymbol ยอมรับเฉพาะรูปแบบที่กำหนด", () => {
    expect(normalizeSymbol(" vti ")).toBe("VTI")
    expect(normalizeSymbol("BRK.B")).toBe("BRK.B")
    expect(normalizeSymbol("1ABC")).toBeNull()
    expect(normalizeSymbol("ABCDEFGHIJ")).toBe("ABCDEFGHIJ") // 10 ตัว = ขอบบนที่ยอมรับได้
    expect(normalizeSymbol("ABCDEFGHIJK")).toBeNull() // 11 ตัว = เกิน
  })
})

describe("US-03 คลังข้อมูลผลตอบแทน", () => {
  let fetchCount: number

  beforeEach(() => {
    fetchCount = 0
  })

  function countingSource(rows: DailyRow[]): RawPriceSource {
    return {
      name: "stooq",
      async fetchDaily() {
        fetchCount++
        return { ok: true, rows }
      },
    }
  }

  test("AC-CCH-01 ขอซ้ำครั้งที่สองไม่ยิงออกข้างนอก และได้ค่าเท่าเดิม", async () => {
    const md = createMarketData({
      sources: [countingSource(dailyRows("2011-12", 175))],
      cache: createMemoryCache({ now }),
      now,
    })

    const first = await md.getMonthlySeries("VTI", RANGE_2012_2026)
    const second = await md.getMonthlySeries("VTI", RANGE_2012_2026)

    expect(fetchCount).toBe(1)
    expect(second.ok && second.series.source).toBe("cache")
    expect(first.ok && second.ok && second.series.returns).toEqual(
      first.ok ? first.series.returns : [],
    )
  })

  test("AC-CCH-02 คลังมีบางส่วน ระบบดึงเพิ่มแล้วต่อให้ครบช่วง", async () => {
    const cache = createMemoryCache({ now })
    const md = createMarketData({
      sources: [countingSource(dailyRows("2011-12", 175))],
      cache,
      now,
    })

    await md.getMonthlySeries("VTI", { start: "2012-01", end: "2024-12" })
    const extended = await md.getMonthlySeries("VTI", RANGE_2012_2026)

    expect(fetchCount).toBe(2)
    expect(extended.ok).toBe(true)
    if (!extended.ok) return
    expect(extended.series.returns).toHaveLength(174)
    expect(extended.series.actualRange).toEqual({ start: "2012-01", end: "2026-06" })
  })

  test("AC-CCH-03 เดือนที่ปิดนานแล้วไม่หมดอายุ", async () => {
    const cache = createMemoryCache({ now: () => new Date("2025-01-10T00:00:00Z") })
    const mdEarlier = createMarketData({
      sources: [countingSource(dailyRows("2011-12", 175))],
      cache,
      now: () => new Date("2025-01-10T00:00:00Z"),
    })
    await mdEarlier.getMonthlySeries("VTI", { start: "2012-01", end: "2024-12" })

    // หนึ่งปีให้หลัง ขอช่วงเดิมอีกครั้ง
    const mdLater = createMarketData({
      sources: [countingSource(dailyRows("2011-12", 175))],
      cache,
      now,
    })
    const again = await mdLater.getMonthlySeries("VTI", { start: "2012-01", end: "2024-12" })

    expect(fetchCount).toBe(1)
    expect(again.ok && again.series.source).toBe("cache")
  })

  test("AC-CCH-04 เดือนที่เพิ่งปิดและเก็บไว้เกิน 24 ชั่วโมง ถูกดึงใหม่", async () => {
    const storedAt = new Date("2026-07-02T00:00:00Z") // มิ.ย. 2026 เพิ่งปิดได้ 1 วัน
    const askedAt = new Date("2026-07-03T06:00:00Z") // ผ่านไป 30 ชั่วโมง
    const cache = createMemoryCache({ now: () => storedAt })

    const mdStore = createMarketData({
      sources: [countingSource(dailyRows("2011-12", 175))],
      cache,
      now: () => storedAt,
    })
    await mdStore.getMonthlySeries("VTI", RANGE_2012_2026)

    const mdLater = createMarketData({
      sources: [countingSource(dailyRows("2011-12", 175))],
      cache: createMemoryCache({ now: () => askedAt }),
      now: () => askedAt,
    })
    const second = await mdLater.getMonthlySeries("VTI", RANGE_2012_2026)

    expect(second.ok).toBe(true)
    if (second.ok) expect(second.series.source).not.toBe("cache")
  })

  test("AC-CCH-05 + EC-CCH-02 คลังอ่านหรือเขียนไม่ได้ คำขอยังสำเร็จ", async () => {
    const brokenRead = createMarketData({
      sources: [countingSource(dailyRows("2011-12", 175))],
      cache: createMemoryCache({ now, failOnRead: true }),
      now,
    })
    const readResult = await brokenRead.getMonthlySeries("VTI", RANGE_2012_2026)
    expect(readResult.ok).toBe(true)

    const brokenWrite = createMarketData({
      sources: [countingSource(dailyRows("2011-12", 175))],
      cache: createMemoryCache({ now, failOnWrite: true }),
      now,
    })
    const writeResult = await brokenWrite.getMonthlySeries("VTI", RANGE_2012_2026)
    expect(writeResult.ok).toBe(true)
    if (writeResult.ok) expect(writeResult.series.returns).toHaveLength(174)
  })

  test("EC-CCH-01 คำขอพร้อมกันตอนคลังว่าง ยิงออกและบันทึกครั้งเดียว", async () => {
    const md = createMarketData({
      sources: [countingSource(dailyRows("2011-12", 175))],
      cache: createMemoryCache({ now }),
      now,
    })

    await Promise.all([
      md.getMonthlySeries("VTI", RANGE_2012_2026),
      md.getMonthlySeries("VTI", RANGE_2012_2026),
      md.getMonthlySeries("VTI", RANGE_2012_2026),
    ])

    expect(fetchCount).toBe(1)
  })
})

describe("ความบริสุทธิ์ของชั้นข้อมูล", () => {
  test("ไม่มีการอ่านเวลาปัจจุบันโดยตรงเมื่อผู้เรียกกำหนด now ให้", async () => {
    const spy = vi.spyOn(globalThis, "Date")
    const md = createMarketData({
      sources: [{ name: "stooq", async fetchDaily() { return { ok: true, rows: dailyRows("2011-12", 175) } } }],
      now,
    })
    await md.getMonthlySeries("VTI", RANGE_2012_2026)
    // Date ถูกเรียกได้จากที่อื่น แต่ผลลัพธ์ต้องขึ้นกับ now ที่ฉีดเข้าไปเท่านั้น
    expect(md.lastClosedMonth()).toBe("2026-06")
    spy.mockRestore()
  })
})
