import { compareMonths, type MonthlyReturn, type MonthRange, type YearMonth } from "@/types/series"
import { isEntryUsable, isFreshMonth, type CachedEntry, type ReturnsCache } from "./types"

export type MemoryCacheOptions = {
  now?: () => Date
  /** จำลองที่เก็บที่อ่านหรือเขียนไม่ได้ เพื่อตรวจ BR-CCH-07 */
  failOnRead?: boolean
  failOnWrite?: boolean
}

export function createMemoryCache(options: MemoryCacheOptions = {}): ReturnsCache {
  const now = options.now ?? (() => new Date())
  const store = new Map<string, Map<YearMonth, CachedEntry>>()

  return {
    async get(symbol, range) {
      if (options.failOnRead) throw new Error("cache read failed")
      const bySymbol = store.get(symbol)
      if (!bySymbol) return []

      const current = now()
      const hits: MonthlyReturn[] = []
      for (const [month, entry] of bySymbol) {
        if (compareMonths(month, range.start) < 0 || compareMonths(month, range.end) > 0) continue
        if (!isEntryUsable(month, entry, current)) continue
        hits.push({ month, value: entry.value })
      }
      return hits.sort((a, b) => compareMonths(a.month, b.month))
    },

    async put(symbol, returns) {
      if (options.failOnWrite) throw new Error("cache write failed")
      const current = now()
      let bySymbol = store.get(symbol)
      if (!bySymbol) {
        bySymbol = new Map()
        store.set(symbol, bySymbol)
      }
      for (const item of returns) {
        bySymbol.set(item.month, {
          value: item.value,
          storedAt: isFreshMonth(item.month, current) ? current.getTime() : undefined,
        })
      }
    },
  }
}

export type { MonthRange }
