import { rm } from "node:fs/promises"
import path from "node:path"
import { describe, expect, test } from "vitest"
import { createFsCache } from "@/data/cache/fs-cache"
import type { MonthRange } from "@/types/series"
import { createMarketData } from "./market-data"
import type { RawPriceSource } from "./raw-source"
import { createStooqSource } from "./stooq"
import { createYahooSource } from "./yahoo"

/**
 * หลักฐานเกณฑ์ปิดรอบ S2 — ใช้เครือข่ายจริง จึงถูกข้ามในการรันปกติ
 * เปิดด้วย: LIVE_SMOKE=1 npx vitest run src/data/providers/live-smoke.test.ts
 */
const enabled = process.env.LIVE_SMOKE === "1"
const CACHE_DIR = path.join(process.cwd(), ".cache", "smoke")
const RANGE: MonthRange = { start: "2012-01", end: "2026-06" }

describe.skipIf(!enabled)("S2 smoke กับข้อมูลจริง", () => {
  test("ขอ VTI สองครั้ง ครั้งที่สองมาจากคลังโดยไม่ยิงออกข้างนอก", async () => {
    await rm(CACHE_DIR, { recursive: true, force: true })

    let outbound = 0
    const counting = (inner: RawPriceSource): RawPriceSource => ({
      name: inner.name,
      async fetchDaily(symbol, range, signal) {
        outbound++
        console.log(`  → ยิงออกไปที่ ${inner.name} สำหรับ ${symbol} (${range.start}..${range.end})`)
        return inner.fetchDaily(symbol, range, signal)
      },
    })

    const provider = createMarketData({
      sources: [counting(createYahooSource()), counting(createStooqSource())],
      cache: createFsCache({ dir: CACHE_DIR }),
    })

    console.log("เดือนล่าสุดที่ปิดแล้ว:", provider.lastClosedMonth())

    console.log("\nครั้งที่ 1 (คลังว่าง):")
    const first = await provider.getMonthlySeries("VTI", RANGE)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    console.log(
      `  ได้ ${first.series.returns.length} เดือน ` +
        `(${first.series.actualRange?.start}..${first.series.actualRange?.end}) จาก "${first.series.source}"`,
    )
    const afterFirst = outbound

    console.log("\nครั้งที่ 2 (ช่วงเดิม):")
    const second = await provider.getMonthlySeries("VTI", RANGE)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    console.log(`  ได้ ${second.series.returns.length} เดือน จาก "${second.series.source}"`)

    console.log("\nสรุป")
    console.log("  ยิงออกข้างนอกครั้งที่ 1:", afterFirst)
    console.log("  ยิงออกข้างนอกเพิ่มในครั้งที่ 2:", outbound - afterFirst)
    console.log("  แหล่งของครั้งที่ 2:", second.series.source)

    expect(outbound - afterFirst).toBe(0)
    expect(second.series.source).toBe("cache")
    expect(second.series.returns).toEqual(first.series.returns)
    expect(first.series.returns.length).toBeGreaterThan(150)
  }, 60_000)
})
