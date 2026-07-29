import type { MonthRange } from "@/types/series"
import type { DailyRow, RawFetchResult, RawPriceSource } from "./raw-source"

const BASE_URL = "https://stooq.com/q/d/l/"

/** Stooq ใช้ suffix .us สำหรับหลักทรัพย์อเมริกา และรับสัญลักษณ์ตัวพิมพ์เล็ก */
function toStooqSymbol(symbol: string): string {
  return `${symbol.toLowerCase()}.us`
}

function toStooqDate(month: string, edge: "start" | "end"): string {
  const [year, m] = month.split("-").map(Number)
  const day = edge === "start" ? 1 : new Date(Date.UTC(year, m, 0)).getUTCDate()
  return `${year}${String(m).padStart(2, "0")}${String(day).padStart(2, "0")}`
}

/**
 * CSV รายวันที่ปรับปันผลและการแตกพาร์แล้ว — แหล่งหลักตาม BR-PRV-03
 * หัวตาราง: Date,Open,High,Low,Close,Volume
 */
export function parseStooqCsv(csv: string): DailyRow[] | null {
  const lines = csv.trim().split("\n")
  if (lines.length < 2) return null

  const header = lines[0].toLowerCase().split(",")
  const dateIndex = header.indexOf("date")
  const closeIndex = header.indexOf("close")
  if (dateIndex === -1 || closeIndex === -1) return null

  const rows: DailyRow[] = []
  for (const line of lines.slice(1)) {
    const cells = line.split(",")
    const date = cells[dateIndex]
    const close = Number(cells[closeIndex])
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !Number.isFinite(close)) continue
    rows.push({ date, adjustedClose: close })
  }
  return rows.length > 0 ? rows : null
}

export function createStooqSource(
  fetchImpl: typeof fetch = fetch,
): RawPriceSource {
  return {
    name: "stooq",
    async fetchDaily(symbol: string, range: MonthRange, signal?: AbortSignal): Promise<RawFetchResult> {
      const url =
        `${BASE_URL}?s=${toStooqSymbol(symbol)}` +
        `&d1=${toStooqDate(range.start, "start")}&d2=${toStooqDate(range.end, "end")}&i=d`

      let response: Response
      try {
        response = await fetchImpl(url, { signal })
      } catch {
        return { ok: false, reason: "technical", detail: "network" }
      }
      if (!response.ok) {
        return { ok: false, reason: "technical", detail: `http ${response.status}` }
      }

      const body = await response.text()
      // Stooq ตอบ "No data" เมื่อไม่รู้จักสัญลักษณ์ — ต่างจากความล้มเหลวเชิงเทคนิค (BR-PRV-04)
      if (/no data/i.test(body)) return { ok: false, reason: "symbol-not-found" }

      const rows = parseStooqCsv(body)
      if (!rows) return { ok: false, reason: "technical", detail: "unreadable csv" }
      return { ok: true, rows }
    },
  }
}
