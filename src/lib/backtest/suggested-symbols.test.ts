import { describe, expect, test } from "vitest"
import en from "@/i18n/locales/en.json"
import th from "@/i18n/locales/th.json"
import { SYMBOL_PATTERN } from "@/types/backtest"
import {
  FULL_HISTORY_SINCE,
  SUGGESTED_SYMBOLS,
  SYMBOL_GROUPS,
  SYMBOL_SECTIONS,
  findSymbol,
  groupOf,
} from "./suggested-symbols"

/**
 * แคตตาล็อกเป็น **ข้อมูล** ไม่ใช่ตรรกะ จึงคุมด้วยกฎที่เครื่องตรวจได้ ไม่ใช่การไล่ดูด้วยตา —
 * 100 รายการใน 19 หมวดเป็นขนาดที่สายตาคนพลาดแน่นอน
 *
 * เทสต์เหล่านี้จับไม่ได้ว่าแหล่งข้อมูลยังมีสัญลักษณ์นั้นอยู่ไหม (ต้องใช้เครือข่าย) —
 * นั่นเป็นหน้าที่ของ `node scripts/probe-symbols.mjs` ที่รันมือ
 */
const resolve = (locale: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => {
    if (typeof node !== "object" || node === null) return undefined
    return (node as Record<string, unknown>)[part]
  }, locale)

const THAI = SYMBOL_SECTIONS.find((s) => s.labelKey === "symbolGroups.thai")!
const GLOBAL = SYMBOL_SECTIONS.find((s) => s.labelKey === "symbolGroups.global")!
const countOf = (section: typeof THAI) =>
  section.groups.reduce((sum, g) => sum + g.symbols.length, 0)

describe("US-23 แคตตาล็อกสินทรัพย์", () => {
  test("AC-CAT-01 มี 100 ตัวพอดี แบ่งไทย 50 ต่างประเทศ 50", () => {
    expect(SUGGESTED_SYMBOLS).toHaveLength(100)
    expect(countOf(THAI), "ฝั่งไทย").toBe(50)
    expect(countOf(GLOBAL), "ฝั่งต่างประเทศ").toBe(50)
  })

  test("AC-CAT-01 ทุกหมวดมีอย่างน้อยหนึ่งตัว ไม่มีหมวดว่าง", () => {
    expect(SYMBOL_GROUPS.length).toBeGreaterThanOrEqual(15)
    for (const group of SYMBOL_GROUPS) {
      expect(group.symbols.length, `หมวด ${group.labelKey}`).toBeGreaterThan(0)
    }
  })

  test("AC-CAT-02 ไม่มีสัญลักษณ์ซ้ำข้ามหมวด", () => {
    const seen = new Map<string, string[]>()
    for (const group of SYMBOL_GROUPS) {
      for (const item of group.symbols) {
        seen.set(item.symbol, [...(seen.get(item.symbol) ?? []), group.labelKey])
      }
    }
    const duplicated = [...seen.entries()].filter(([, groups]) => groups.length > 1)
    expect(duplicated, `ซ้ำ: ${duplicated.map(([s, g]) => `${s} (${g.join(", ")})`).join(" · ")}`)
      .toEqual([])
  })

  test("AC-CAT-03 ทุกสัญลักษณ์ผ่านกฎรูปแบบของฟอร์ม", () => {
    // ข้อนี้คือตัวที่จะจับ `1DIV.BK` (ขึ้นต้นด้วยตัวเลข) ถ้าเผลอใส่กลับเข้ามา
    const rejected = SUGGESTED_SYMBOLS.filter((item) => !SYMBOL_PATTERN.test(item.symbol))
    expect(rejected.map((r) => r.symbol)).toEqual([])
  })

  test("AC-CAT-04 ทุกสัญลักษณ์มีชื่อครบทั้งภาษาไทยและอังกฤษ", () => {
    const missing: string[] = []
    for (const item of SUGGESTED_SYMBOLS) {
      if (typeof resolve(th, item.labelKey) !== "string") missing.push(`th ${item.symbol}`)
      if (typeof resolve(en, item.labelKey) !== "string") missing.push(`en ${item.symbol}`)
    }
    expect(missing).toEqual([])
  })

  test("AC-CAT-04 ทุกหมวดมีหัวข้อครบทั้งสองภาษา", () => {
    const keys = [
      ...SYMBOL_SECTIONS.map((s) => s.labelKey),
      ...SYMBOL_GROUPS.map((g) => g.labelKey),
    ]
    const missing: string[] = []
    for (const key of keys) {
      if (typeof resolve(th, key) !== "string") missing.push(`th ${key}`)
      if (typeof resolve(en, key) !== "string") missing.push(`en ${key}`)
    }
    expect(missing).toEqual([])
  })

  test("BR-CAT-03 ทุกตัวมีปีที่ข้อมูลเริ่มอยู่ในช่วงที่เป็นไปได้", () => {
    for (const item of SUGGESTED_SYMBOLS) {
      expect(Number.isInteger(item.since), `${item.symbol} ต้องเป็นปีจำนวนเต็ม`).toBe(true)
      expect(item.since, `${item.symbol} เก่าเกินจริง`).toBeGreaterThanOrEqual(1990)
      expect(item.since, `${item.symbol} เป็นอนาคต`).toBeLessThanOrEqual(2026)
    }
  })

  test("BR-CAT-04 มีทั้งตัวข้อมูลเต็มและตัวที่ต้องกำกับปี", () => {
    const short = SUGGESTED_SYMBOLS.filter((item) => item.since > FULL_HISTORY_SINCE)
    const full = SUGGESTED_SYMBOLS.filter((item) => item.since <= FULL_HISTORY_SINCE)

    // ถ้าฝั่งใดฝั่งหนึ่งว่าง แปลว่าเกณฑ์ปีเพี้ยนไปแล้ว
    expect(short.length).toBeGreaterThan(0)
    expect(full.length).toBeGreaterThan(0)
    // ตัวที่รู้ว่าข้อมูลสั้นจริงต้องถูกจัดเข้าฝั่งที่ต้องกำกับปี
    for (const symbol of ["SCB.BK", "GULF.BK", "BTC-USD", "IBIT"]) {
      expect(findSymbol(symbol)!.since, symbol).toBeGreaterThan(FULL_HISTORY_SINCE)
    }
    // ส่วนตัวที่ข้อมูลเต็มต้องไม่ถูกกำกับ
    for (const symbol of ["PTT.BK", "VTI", "SPY"]) {
      expect(findSymbol(symbol)!.since, symbol).toBeLessThanOrEqual(FULL_HISTORY_SINCE)
    }
  })

  test("รายการแบนกับรายการแบ่งหมวดเป็นชุดเดียวกัน", () => {
    const fromGroups = SYMBOL_GROUPS.flatMap((g) => g.symbols.map((x) => x.symbol))
    expect(SUGGESTED_SYMBOLS.map((x) => x.symbol)).toEqual(fromGroups)
  })

  test("ค้นสัญลักษณ์และหาหมวดของมันได้", () => {
    expect(findSymbol("PTT.BK")?.labelKey).toBe("symbols.ptt")
    expect(groupOf("PTT.BK")?.labelKey).toBe("symbolGroups.thaiEnergy")
    expect(findSymbol("ไม่มีจริง")).toBeUndefined()
    expect(groupOf("ไม่มีจริง")).toBeUndefined()
  })

  test("สัญลักษณ์ที่เคยอยู่ในรายการตั้งแต่ S11 ยังอยู่ครบ", () => {
    // ลิงก์ที่แชร์ไปแล้วอ้างถึงตัวพวกนี้ — หายไปเมื่อไรคือทำของเดิมพัง
    for (const symbol of ["VTI", "VXUS", "BND", "VNQ", "SPY", "PTT.BK", "CPALL.BK", "AOT.BK", "ADVANC.BK", "KBANK.BK"]) {
      expect(findSymbol(symbol), symbol).toBeDefined()
    }
  })
})
