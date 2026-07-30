import {
  compareMonths,
  shiftMonth,
  toYearMonth,
  type MonthlyReturn,
  type MonthRange,
  type PriceProvider,
  type ProviderFailure,
  type SeriesResult,
  type SeriesSource,
  type YearMonth,
} from "@/types/series"
import type { ReturnsCache } from "@/data/cache/types"
import { normalizeToMonthlyReturns } from "./normalize"
import type { RawPriceSource } from "./raw-source"

/**
 * รูปแบบสัญลักษณ์ที่ชั้นข้อมูลยอมรับ — สินทรัพย์ทั่วไป หรือคู่สกุลเงิน (เช่น `THB=X`)
 *
 * กว้างกว่ากฎของฟอร์มโดยตั้งใจ เพราะกฎของฟอร์มคุมสิ่งที่**ผู้ใช้พิมพ์เข้ามาเป็นสินทรัพย์ในพอร์ต**
 * ส่วนกฎนี้คุมสิ่งที่**ระบบขอจากแหล่งข้อมูลได้** ซึ่งรวมอัตราแลกเปลี่ยนที่ระบบเรียกเองเบื้องหลัง
 */
const SYMBOL_PATTERN = /^([A-Z][A-Z0-9.-]{0,9}|[A-Z]{3}=X)$/
const DEFAULT_TIMEOUT_MS = 10_000

export type MarketDataOptions = {
  sources: RawPriceSource[]
  cache?: ReturnsCache
  now?: () => Date
  timeoutMs?: number
}

/** ตัดช่องว่างและแปลงเป็นตัวพิมพ์ใหญ่ก่อนใช้เสมอ ตาม BR-PRV-09 */
export function normalizeSymbol(input: string): string | null {
  const candidate = input.trim().toUpperCase()
  return SYMBOL_PATTERN.test(candidate) ? candidate : null
}

/** เดือนล่าสุดที่ปิดแล้ว = เดือนก่อนเดือนปัจจุบัน ตาม BR-FND-01 (ปฏิทินล้วน ไม่เรียกภายนอก) */
export function lastClosedMonthFrom(now: Date): YearMonth {
  return shiftMonth(toYearMonth(now.getUTCFullYear(), now.getUTCMonth() + 1), -1)
}

export function createMarketData(options: MarketDataOptions): PriceProvider {
  const now = options.now ?? (() => new Date())
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  // คำขอสัญลักษณ์เดียวกันที่ซ้อนกันต้องยิงออกครั้งเดียว ตาม BR-PRV-07
  const inFlight = new Map<string, Promise<SeriesResult>>()

  const provider: PriceProvider = {
    lastClosedMonth() {
      return lastClosedMonthFrom(now())
    },

    async getMonthlySeries(rawSymbol, requestedRange) {
      const symbol = normalizeSymbol(rawSymbol)
      // รูปแบบผิดถือว่าไม่พบทันที โดยไม่เรียกออกไปข้างนอก (EC-PRV-01)
      if (!symbol) return notFound(rawSymbol.trim().toUpperCase())

      const range = clampToClosedMonths(requestedRange, provider.lastClosedMonth())
      if (!range) return emptySeries(symbol, "cache")

      const key = `${symbol}|${range.start}|${range.end}`
      const existing = inFlight.get(key)
      if (existing) return existing

      const work = resolveSeries(symbol, range).finally(() => inFlight.delete(key))
      inFlight.set(key, work)
      return work
    },
  }

  async function resolveSeries(symbol: string, range: MonthRange): Promise<SeriesResult> {
    const cached = await readCache(symbol, range)
    if (isContiguousCover(cached, range)) {
      return okSeries(symbol, cached, "cache")
    }

    const fetched = await fetchFromSources(symbol, range)
    if (!fetched.ok) return fetched

    const merged = mergeReturns(cached, fetched.returns)
    // ต้องรอให้บันทึกเสร็จก่อนคืนผล ไม่เช่นนั้นคำขอถัดไปอาจอ่านคลังก่อนเขียนเสร็จแล้วยิงออกซ้ำ
    await writeCache(symbol, fetched.returns)
    return okSeries(symbol, merged, cached.length > 0 ? "mixed" : fetched.source)
  }

  async function readCache(symbol: string, range: MonthRange): Promise<MonthlyReturn[]> {
    if (!options.cache) return []
    try {
      return await options.cache.get(symbol, range)
    } catch {
      // คลังพังต้องไม่ทำให้คำขอล้ม ตาม BR-CCH-07 — ทำงานต่อโดยดึงจากแหล่งข้อมูลตรง
      return []
    }
  }

  async function writeCache(symbol: string, returns: MonthlyReturn[]): Promise<void> {
    if (!options.cache || returns.length === 0) return
    try {
      await options.cache.put(symbol, returns, provider.lastClosedMonth())
    } catch {
      // เช่นเดียวกับการอ่าน: เขียนไม่ได้ไม่ใช่เหตุให้คำขอล้ม
    }
  }

  async function fetchFromSources(
    symbol: string,
    range: MonthRange,
  ): Promise<
    { ok: true; returns: MonthlyReturn[]; source: SeriesSource } | { ok: false; failure: ProviderFailure }
  > {
    // ดึงเผื่อหนึ่งเดือนก่อนช่วงที่ขอ เพื่อให้เดือนแรกของช่วงมีราคาฐาน ตาม BR-PRV-10
    const fetchRange: MonthRange = { start: shiftMonth(range.start, -1), end: range.end }
    let sourcesTried = 0

    for (const source of options.sources) {
      sourcesTried++
      const result = await withTimeout(
        (signal) => source.fetchDaily(symbol, fetchRange, signal),
        timeoutMs,
      )

      if (result.ok) {
        const normalized = normalizeToMonthlyReturns(result.rows, provider.lastClosedMonth())
        const inRange = normalized.returns.filter(
          (r) => compareMonths(r.month, range.start) >= 0 && compareMonths(r.month, range.end) <= 0,
        )
        // ตอบสำเร็จแต่ไม่มีข้อมูลใช้ได้เลย ถือเป็นความล้มเหลวเชิงเทคนิค ลองแหล่งถัดไป (EC-PRV-02)
        if (inRange.length === 0) continue
        return { ok: true, returns: inRange, source: source.name as SeriesSource }
      }

      // แหล่งยืนยันว่าไม่มีสัญลักษณ์นี้ ห้ามลองแหล่งสำรอง ตาม BR-PRV-04
      if (result.reason === "symbol-not-found") {
        return { ok: false, failure: { kind: "symbol-not-found", symbol } }
      }
    }

    return { ok: false, failure: { kind: "unreachable", symbol, sourcesTried } }
  }

  return provider
}

async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T | { ok: false; reason: "technical"; detail: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await run(controller.signal)
  } catch {
    return { ok: false, reason: "technical", detail: "aborted" }
  } finally {
    clearTimeout(timer)
  }
}

/** ตัดปลายช่วงไม่ให้เกินเดือนที่ปิดแล้ว (EC-PRV-04) */
function clampToClosedMonths(range: MonthRange, lastClosed: YearMonth): MonthRange | null {
  const end = compareMonths(range.end, lastClosed) > 0 ? lastClosed : range.end
  if (compareMonths(range.start, end) > 0) return null
  return { start: range.start, end }
}

/** คลังครอบคลุมช่วงแบบต่อเนื่องหรือไม่ — ขาดตรงกลางก็ต้องไปดึงเพิ่ม ตาม BR-CCH-06 */
function isContiguousCover(returns: MonthlyReturn[], range: MonthRange): boolean {
  if (returns.length === 0) return false
  if (returns[0].month !== range.start || returns[returns.length - 1].month !== range.end) return false
  for (let i = 1; i < returns.length; i++) {
    if (returns[i].month !== shiftMonth(returns[i - 1].month, 1)) return false
  }
  return true
}

function mergeReturns(cached: MonthlyReturn[], fetched: MonthlyReturn[]): MonthlyReturn[] {
  const byMonth = new Map<YearMonth, number>()
  for (const item of cached) byMonth.set(item.month, item.value)
  // ค่าที่เพิ่งดึงมาทับของเก่าเสมอ
  for (const item of fetched) byMonth.set(item.month, item.value)
  return [...byMonth.entries()]
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => compareMonths(a.month, b.month))
}

function okSeries(symbol: string, returns: MonthlyReturn[], source: SeriesSource): SeriesResult {
  return {
    ok: true,
    series: {
      symbol,
      returns,
      actualRange:
        returns.length > 0
          ? { start: returns[0].month, end: returns[returns.length - 1].month }
          : null,
      source,
    },
  }
}

function emptySeries(symbol: string, source: SeriesSource): SeriesResult {
  return { ok: true, series: { symbol, returns: [], actualRange: null, source } }
}

function notFound(symbol: string): SeriesResult {
  return { ok: false, failure: { kind: "symbol-not-found", symbol } }
}
