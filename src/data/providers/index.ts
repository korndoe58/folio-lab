import type { PriceProvider } from "@/types/series"
import { createFsCache } from "@/data/cache/fs-cache"
import { createMarketData } from "./market-data"
import { createStooqSource } from "./stooq"
import { createStubProvider } from "./stub"
import { createYahooSource } from "./yahoo"

export type DataMode = "stub" | "live"

/** ค่าเริ่มต้นคือข้อมูลจริง (PD-010) — โหมดจำลองใช้เฉพาะตอนทดสอบที่ต้องการผลเหมือนเดิมทุกครั้ง */
export function resolveDataMode(): DataMode {
  return process.env.NEXT_PUBLIC_DATA_MODE === "stub" ? "stub" : "live"
}

/** แหล่งข้อมูลจริงเรียงตามลำดับที่จะลอง — ลำดับนี้บันทึกไว้ที่ PD-006 */
export function createLiveProvider(): PriceProvider {
  return createMarketData({
    sources: [createYahooSource(), createStooqSource()],
    cache: createFsCache(),
  })
}

/**
 * ชั้นข้อมูลฝั่งเครื่องแม่ข่าย — ใช้โดยเส้นทาง `/api/series` และสคริปต์
 * (ฝั่งเบราว์เซอร์ใช้ `browser.ts` ซึ่งเรียกผ่านเส้นทางนั้นอีกที)
 */
export function getMarketData(): PriceProvider {
  return resolveDataMode() === "live" ? createLiveProvider() : createStubProvider()
}

export { createMarketData } from "./market-data"
export { createStubProvider, STUB_LAST_CLOSED_MONTH } from "./stub"
