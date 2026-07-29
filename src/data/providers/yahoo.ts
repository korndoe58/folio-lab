import type { MonthRange } from "@/types/series"
import type { DailyRow, RawFetchResult, RawPriceSource } from "./raw-source"

const BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/"

function toEpochSeconds(month: string, edge: "start" | "end"): number {
  const [year, m] = month.split("-").map(Number)
  return edge === "start"
    ? Math.floor(Date.UTC(year, m - 1, 1) / 1000)
    : Math.floor(Date.UTC(year, m, 1) / 1000)
}

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[]
      indicators?: { adjclose?: Array<{ adjclose?: Array<number | null> }> }
    }> | null
    error?: { code?: string } | null
  }
}

/** ใช้ adjclose เท่านั้น เพราะเป็นชุดที่รวมปันผลและปรับการแตกพาร์แล้ว */
export function parseYahooChart(payload: unknown): DailyRow[] | null {
  const data = payload as YahooChartResponse
  const result = data?.chart?.result?.[0]
  const timestamps = result?.timestamp
  const closes = result?.indicators?.adjclose?.[0]?.adjclose
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return null

  const rows: DailyRow[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i]
    if (typeof close !== "number" || !Number.isFinite(close)) continue
    rows.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      adjustedClose: close,
    })
  }
  return rows.length > 0 ? rows : null
}

export function createYahooSource(fetchImpl: typeof fetch = fetch): RawPriceSource {
  return {
    name: "yahoo",
    async fetchDaily(symbol: string, range: MonthRange, signal?: AbortSignal): Promise<RawFetchResult> {
      const url =
        `${BASE_URL}${encodeURIComponent(symbol)}` +
        `?period1=${toEpochSeconds(range.start, "start")}&period2=${toEpochSeconds(range.end, "end")}` +
        `&interval=1d&events=div%2Csplit`

      let response: Response
      try {
        response = await fetchImpl(url, { signal })
      } catch {
        return { ok: false, reason: "technical", detail: "network" }
      }
      // Yahoo ตอบ 404 เมื่อไม่รู้จักสัญลักษณ์
      if (response.status === 404) return { ok: false, reason: "symbol-not-found" }
      if (!response.ok) return { ok: false, reason: "technical", detail: `http ${response.status}` }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        return { ok: false, reason: "technical", detail: "unreadable json" }
      }

      const rows = parseYahooChart(payload)
      if (!rows) return { ok: false, reason: "technical", detail: "unexpected shape" }
      return { ok: true, rows }
    },
  }
}
