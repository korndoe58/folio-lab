/**
 * ดึงข้อมูลจริงหนึ่งครั้งแล้ว freeze เป็น fixture (S2)
 *
 * fixture ที่ได้คือชุดที่ชุดทดสอบ golden ของ S3 และ StubProvider ใช้ร่วมกัน
 * รันซ้ำได้ แต่ผลจะเปลี่ยนเมื่อแหล่งข้อมูลมีเดือนใหม่ — ตั้งใจให้รันนาน ๆ ครั้ง
 *
 *   node scripts/freeze-fixtures.mjs
 */
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const OUT_DIR = path.join(process.cwd(), "src/data/fixtures")
const RANGE = { start: "2011-12", end: "2026-06" } // เผื่อเดือนฐาน ธ.ค. 2011 ตาม BR-PRV-10
const SYMBOLS = ["VTI", "VNQ", "VXUS", "BND", "SPY"]

function toStooqDate(month, edge) {
  const [year, m] = month.split("-").map(Number)
  const day = edge === "start" ? 1 : new Date(Date.UTC(year, m, 0)).getUTCDate()
  return `${year}${String(m).padStart(2, "0")}${String(day).padStart(2, "0")}`
}

async function fetchStooq(symbol) {
  const url =
    `https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}.us` +
    `&d1=${toStooqDate(RANGE.start, "start")}&d2=${toStooqDate(RANGE.end, "end")}&i=d`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`stooq http ${res.status}`)
  const body = await res.text()
  if (/no data/i.test(body)) throw new Error("stooq: no data")

  const lines = body.trim().split("\n")
  const header = lines[0].toLowerCase().split(",")
  const di = header.indexOf("date")
  const ci = header.indexOf("close")
  if (di === -1 || ci === -1) throw new Error("stooq: unexpected header")

  const rows = []
  for (const line of lines.slice(1)) {
    const cells = line.split(",")
    const close = Number(cells[ci])
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cells[di]) || !Number.isFinite(close)) continue
    rows.push({ date: cells[di], adjustedClose: close })
  }
  return rows
}

async function fetchYahoo(symbol) {
  const p1 = Math.floor(Date.UTC(2011, 11, 1) / 1000)
  const p2 = Math.floor(Date.UTC(2026, 6, 1) / 1000)
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
    `?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplit`
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
  if (!res.ok) throw new Error(`yahoo http ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  const stamps = result?.timestamp
  const closes = result?.indicators?.adjclose?.[0]?.adjclose
  if (!Array.isArray(stamps) || !Array.isArray(closes)) throw new Error("yahoo: unexpected shape")

  const rows = []
  for (let i = 0; i < stamps.length; i++) {
    const close = closes[i]
    if (typeof close !== "number" || !Number.isFinite(close)) continue
    rows.push({ date: new Date(stamps[i] * 1000).toISOString().slice(0, 10), adjustedClose: close })
  }
  return rows
}

/** เหมือน normalizeToMonthlyReturns ของ src — คัดวันสุดท้ายของเดือนแล้วหารกับเดือนก่อนหน้า */
function toMonthlyReturns(rows, lastClosedMonth) {
  const latest = new Map()
  for (const row of rows) {
    const month = row.date.slice(0, 7)
    if (month > lastClosedMonth) continue
    const existing = latest.get(month)
    if (!existing || row.date >= existing.date) latest.set(month, row)
  }
  const monthEnds = [...latest.entries()]
    .map(([month, r]) => ({ month, price: r.adjustedClose }))
    .sort((a, b) => (a.month < b.month ? -1 : 1))

  const returns = []
  for (let i = 1; i < monthEnds.length; i++) {
    const prev = monthEnds[i - 1]
    const cur = monthEnds[i]
    const [py, pm] = prev.month.split("-").map(Number)
    const [cy, cm] = cur.month.split("-").map(Number)
    if ((cy - py) * 12 + (cm - pm) !== 1 || prev.price <= 0) break
    returns.push({ month: cur.month, value: cur.price / prev.price - 1 })
  }
  return returns
}

/** อัตรา T-Bill 3 เดือน (FRED TB3MS) แปลงจากอัตราต่อปีเป็นอัตราต่อเดือน */
async function fetchRiskFreeRates() {
  const url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=TB3MS"
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fred http ${res.status}`)
  const body = await res.text()

  const returns = []
  for (const line of body.trim().split("\n").slice(1)) {
    const [date, value] = line.split(",")
    const annualPercent = Number(value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !Number.isFinite(annualPercent)) continue
    const month = date.slice(0, 7)
    if (month < "2012-01" || month > RANGE.end) continue
    returns.push({ month, value: (1 + annualPercent / 100) ** (1 / 12) - 1 })
  }
  return returns
}

/** ชุดสังเคราะห์สำหรับทดสอบพฤติกรรมขอบ ตาม BR-CCH-09 */
function syntheticFixtures() {
  const months = (from, count) => {
    const out = []
    let [y, m] = from.split("-").map(Number)
    for (let i = 0; i < count; i++) {
      out.push(`${y}-${String(m).padStart(2, "0")}`)
      if (++m > 12) {
        m = 1
        y++
      }
    }
    return out
  }

  return {
    // ข้อมูลเริ่มช้ากว่าชุดอ้างอิง ใช้ทดสอบการย่อช่วง
    NEWFUND: months("2020-01", 78).map((month, i) => ({
      month,
      value: 0.006 + 0.004 * Math.sin(i / 3),
    })),
    // ทำจุดสูงสุดแล้วลงต่อเนื่องจนจบ ไม่ฟื้น
    DOWNONLY: months("2012-01", 174).map((month, i) => ({
      month,
      value: i < 12 ? 0.02 : -0.004,
    })),
    // ไม่มีเดือนติดลบเลย ใช้ทดสอบค่าที่คำนวณไม่ได้
    UPONLY: months("2012-01", 174).map((month, i) => ({
      month,
      value: 0.004 + (i % 5) * 0.0005,
    })),
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const lastClosedMonth = RANGE.end
  const summary = []

  for (const symbol of SYMBOLS) {
    let rows
    let source
    try {
      rows = await fetchStooq(symbol)
      source = "stooq"
    } catch (stooqError) {
      console.warn(`  stooq ล้มเหลวสำหรับ ${symbol}: ${stooqError.message} — ลอง yahoo`)
      rows = await fetchYahoo(symbol)
      source = "yahoo"
    }

    const returns = toMonthlyReturns(rows, lastClosedMonth)
    const payload = {
      symbol,
      source,
      frozenFrom: `${RANGE.start}..${RANGE.end}`,
      returns,
    }
    await writeFile(path.join(OUT_DIR, `${symbol.toLowerCase()}.json`), JSON.stringify(payload), "utf8")
    summary.push({ symbol, source, count: returns.length, first: returns[0]?.month, last: returns.at(-1)?.month })
  }

  const rfReturns = await fetchRiskFreeRates()
  await writeFile(
    path.join(OUT_DIR, "rf.json"),
    JSON.stringify({ symbol: "RF", source: "fred-tb3ms", frozenFrom: `${RANGE.start}..${RANGE.end}`, returns: rfReturns }),
    "utf8",
  )
  summary.push({ symbol: "RF", source: "fred", count: rfReturns.length, first: rfReturns[0]?.month, last: rfReturns.at(-1)?.month })

  for (const [symbol, returns] of Object.entries(syntheticFixtures())) {
    await writeFile(
      path.join(OUT_DIR, `${symbol.toLowerCase()}.json`),
      JSON.stringify({ symbol, source: "synthetic", frozenFrom: "synthetic", returns }),
      "utf8",
    )
    summary.push({ symbol, source: "synthetic", count: returns.length, first: returns[0]?.month, last: returns.at(-1)?.month })
  }

  console.table(summary)
}

main().catch((error) => {
  console.error("freeze ล้มเหลว:", error.message)
  process.exit(1)
})
