/**
 * ตรวจว่าแคตตาล็อกยังตรงกับแหล่งข้อมูลจริงไหม (BR-CAT-14)
 *
 * ปีที่ข้อมูลเริ่มใน `suggested-symbols.ts` เป็น **ภาพนิ่ง ณ วันที่ยิงถาม** (BR-CAT-09,
 * [PD-017](../docs/product/decision-log.md)) — มันเก่าลงเงียบ ๆ ได้ และตั๋วก็ตายได้
 * (เจอมาแล้วตอนสำรวจ: MAKRO ควบรวมเป็น CPAXT · ESSO ถูกบางจากซื้อ)
 * สคริปต์นี้คือเครื่องมือที่ทำให้เรื่องพวกนั้นตรวจเจอในนาทีเดียวแทนที่จะรอผู้ใช้แจ้ง
 *
 * รันมือ ไม่ผูกกับชุดทดสอบอัตโนมัติเพราะต้องใช้เครือข่าย:
 *
 *   node scripts/probe-symbols.mjs
 *
 * คืนสถานะ 1 เมื่อพบตัวที่หายไปหรือปีไม่ตรง เพื่อให้เอาไปต่อท่อกับอย่างอื่นได้
 */
import { readFile } from "node:fs/promises"
import path from "node:path"

const CATALOGUE = path.join(process.cwd(), "src/lib/backtest/suggested-symbols.ts")
const RANGE_START = Date.UTC(2011, 11, 1)
const RANGE_END = Date.UTC(2026, 6, 1)
const PAUSE_MS = 220

/**
 * อ่านสัญลักษณ์กับปีออกจากไฟล์แคตตาล็อกตรง ๆ
 * ไม่ import เพราะไฟล์เป็น TypeScript และสคริปต์นี้รันด้วย node เปล่า ๆ
 */
async function readCatalogue() {
  const source = await readFile(CATALOGUE, "utf8")
  const entries = []
  const pattern = /s\("([^"]+)",\s*"([^"]+)",\s*(\d{4})\)/g
  let match
  while ((match = pattern.exec(source)) !== null) {
    entries.push({ symbol: match[1], labelKey: match[2], since: Number(match[3]) })
  }
  return entries
}

async function probe(symbol) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${Math.floor(RANGE_START / 1000)}&period2=${Math.floor(RANGE_END / 1000)}&interval=1mo`

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
      if (!res.ok) {
        if (attempt === 1) return { ok: false, why: `แหล่งข้อมูลตอบ ${res.status}` }
        await sleep(800)
        continue
      }
      const json = await res.json()
      const result = json?.chart?.result?.[0]
      const stamps = result?.timestamp
      const closes = result?.indicators?.adjclose?.[0]?.adjclose
      if (!Array.isArray(stamps) || !Array.isArray(closes)) {
        return { ok: false, why: "ไม่มีชุดข้อมูล" }
      }
      const firstIndex = closes.findIndex((c) => typeof c === "number")
      if (firstIndex === -1) return { ok: false, why: "ไม่มีราคาที่ใช้ได้เลย" }
      return { ok: true, since: new Date(stamps[firstIndex] * 1000).getUTCFullYear() }
    } catch (error) {
      if (attempt === 1) return { ok: false, why: String(error).slice(0, 60) }
      await sleep(800)
    }
  }
  return { ok: false, why: "ลองสองครั้งแล้วไม่สำเร็จ" }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const catalogue = await readCatalogue()
  if (catalogue.length === 0) throw new Error("อ่านแคตตาล็อกไม่ออก — รูปแบบไฟล์เปลี่ยนไปหรือเปล่า")

  console.log(`ตรวจ ${catalogue.length} สัญลักษณ์กับแหล่งข้อมูลจริง…\n`)
  const missing = []
  const drifted = []

  for (const entry of catalogue) {
    const result = await probe(entry.symbol)
    if (!result.ok) {
      missing.push({ ...entry, why: result.why })
      console.log(`✗ ${entry.symbol.padEnd(11)} ${result.why}`)
    } else if (result.since !== entry.since) {
      drifted.push({ ...entry, actual: result.since })
      console.log(`~ ${entry.symbol.padEnd(11)} บันทึกไว้ ${entry.since} แต่จริง ๆ ${result.since}`)
    }
    await sleep(PAUSE_MS)
  }

  const clean = catalogue.length - missing.length - drifted.length
  console.log(`\nตรงตามที่บันทึก ${clean} · ปีไม่ตรง ${drifted.length} · หาไม่เจอ ${missing.length}`)

  if (missing.length > 0) {
    console.log("\nหาไม่เจอ — ตั๋วอาจถูกเพิกถอนหรือเปลี่ยนชื่อ ต้องหาตัวแทนแล้วแก้แคตตาล็อก:")
    for (const m of missing) console.log(`  ${m.symbol} (${m.labelKey}) — ${m.why}`)
  }
  if (drifted.length > 0) {
    console.log("\nปีไม่ตรง — แก้ค่า since ในแคตตาล็อกให้ตรงกับที่แหล่งข้อมูลตอบ:")
    for (const d of drifted) console.log(`  ${d.symbol}: ${d.since} → ${d.actual}`)
  }
  if (missing.length === 0 && drifted.length === 0) {
    console.log("แคตตาล็อกยังตรงกับแหล่งข้อมูลทุกตัว")
  }

  process.exitCode = missing.length + drifted.length > 0 ? 1 : 0
}

await main()
