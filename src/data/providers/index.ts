import type { PriceProvider } from "@/types/series"
import { createFsCache } from "@/data/cache/fs-cache"
import { createMarketData } from "./market-data"
import { createStooqSource } from "./stooq"
import { createStubProvider } from "./stub"
import { createYahooSource } from "./yahoo"

export type DataMode = "stub" | "live"

export function resolveDataMode(): DataMode {
  return process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "stub"
}

/** แหล่งข้อมูลจริงเรียงตามลำดับที่จะลอง — ลำดับนี้บันทึกไว้ที่ PD-006 */
export function createLiveProvider(): PriceProvider {
  return createMarketData({
    sources: [createYahooSource(), createStooqSource()],
    cache: createFsCache(),
  })
}

/**
 * จุดเดียวที่หน้าจอขอข้อมูลได้ — หน้าจอไม่รู้ว่าเบื้องหลังเป็นข้อมูลจริงหรือข้อมูลจำลอง
 * ค่าเริ่มต้นคือข้อมูลจำลองจนกว่าจะสลับใน S8
 */
export function getMarketData(): PriceProvider {
  return resolveDataMode() === "live" ? createLiveProvider() : createStubProvider()
}

export { createMarketData } from "./market-data"
export { createStubProvider, STUB_LAST_CLOSED_MONTH } from "./stub"
