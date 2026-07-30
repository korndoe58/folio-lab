import { describe, expect, test } from "vitest"
import bnd from "@/data/fixtures/bnd.json"
import spy from "@/data/fixtures/spy.json"
import vti from "@/data/fixtures/vti.json"
import { commonRange, endBalance, portfolioReturns } from "@/engine"
import type { MonthlyReturn } from "@/types/series"
import { buildMonthlyData, type MonthlyRow } from "./chart-data"
import { buildMonthlyCsv, csvFileName } from "./csv"

const LABELS = {
  title: "ผลตอบแทนรายเดือน · 2015-01 ถึง 2025-12 · ดอลลาร์สหรัฐ · ไม่หักเงินเฟ้อ",
  monthColumn: "เดือน",
  summary: "ตัวเลขชุดนี้เป็นผลตอบแทนของพอร์ตล้วน ๆ ไม่รวมเงินเข้าออกและไม่หักเงินเฟ้อ",
}

const build = (rows: MonthlyRow[], portfolioNames: string[]) =>
  buildMonthlyCsv({
    rows,
    portfolioNames,
    benchmarkSymbol: "SPY",
    range: { start: "2015-01", end: "2025-12" },
    ...LABELS,
  })

const lines = (csv: string) => csv.replace(/^﻿/, "").trimEnd().split("\r\n")

/** พอร์ตจริงจากชุดที่ freeze ไว้ ใช้ยืนยันว่าค่าในไฟล์คำนวณกลับได้ตรงกับที่เว็บแสดง */
function referenceRows() {
  const assets = [
    { symbol: "VTI", weight: 60, returns: vti.returns },
    { symbol: "BND", weight: 40, returns: bnd.returns },
  ]
  const shared = commonRange(assets)!
  const clip = (r: MonthlyReturn[]) =>
    r.filter((x) => x.month >= shared.range.start && x.month <= shared.range.end)

  const result = portfolioReturns(assets.map((a) => ({ ...a, returns: clip(a.returns) })))
  const benchmark = clip(spy.returns as MonthlyReturn[])
  return { rows: buildMonthlyData([result.returns], benchmark), returns: result.returns }
}

describe("US-21 ไฟล์ผลตอบแทนรายเดือน", () => {
  test("AC-CMP-54 มีบรรทัดหัวเรื่องแล้วตามด้วยหัวคอลัมน์ที่เป็นชื่อพอร์ต", () => {
    const rows: MonthlyRow[] = [{ month: "2015-01", values: [0.0421], benchmark: 0.0436 }]
    const out = lines(build(rows, ["ผสม"]))

    expect(out[0]).toContain("ผลตอบแทนรายเดือน")
    expect(out[1]).toContain("ไม่รวมเงินเข้าออก")
    expect(out[2]).toBe("เดือน,ผสม,SPY")
    expect(out[3]).toBe("2015-01,0.0421,0.0436")
  })

  test("ไฟล์ขึ้นต้นด้วยเครื่องหมายที่ทำให้โปรแกรมตารางคำนวณอ่านภาษาไทยถูก", () => {
    const csv = build([{ month: "2015-01", values: [0.01], benchmark: 0.02 }], ["พอร์ตไทย"])
    expect(csv.startsWith("﻿")).toBe(true)
    // EC-CMP-29 ชื่อไทยล้วนไม่ถูกครอบเกินจำเป็น
    expect(csv).toContain("เดือน,พอร์ตไทย,SPY")
  })

  test("AC-CMP-55 ตัวเลขเป็นสัดส่วนดิบไม่ปัดเศษ", () => {
    const raw = 0.050700321913573765
    const csv = build([{ month: "2012-01", values: [raw], benchmark: 0.01 }], ["ผสม"])

    expect(csv).toContain("0.050700321913573765")
    // ไม่ใช่ค่าที่ปัดแล้วอย่างบนจอ
    expect(csv).not.toContain("5.07%")
  })

  test("AC-CMP-55 คำนวณผลคูณต่อเนื่องจากไฟล์แล้วได้มูลค่าสุดท้ายตรงกับที่เว็บแสดง", () => {
    const { rows, returns } = referenceRows()
    const out = lines(build(rows, ["ผสม"])).slice(3)

    // อ่านค่ากลับจากไฟล์เหมือนที่ผู้ใช้จะทำในโปรแกรมตารางคำนวณ
    const fromFile = out.reduce((value, line) => value * (1 + Number(line.split(",")[1])), 10_000)

    expect(out).toHaveLength(returns.length)
    expect(fromFile).toBeCloseTo(endBalance(returns, 10_000), 6)
  })

  test("AC-CMP-57 ชื่อพอร์ตที่มีตัวคั่นอยู่ในชื่อ ถูกครอบให้อยู่คอลัมน์เดียว", () => {
    const out = lines(build([{ month: "2015-01", values: [0.01], benchmark: 0.02 }], ["หุ้น, พันธบัตร"]))

    expect(out[2]).toBe('เดือน,"หุ้น, พันธบัตร",SPY')
    // อ่านกลับแล้วยังได้สามคอลัมน์ ไม่ใช่สี่
    expect(parseCsvLine(out[2])).toEqual(["เดือน", "หุ้น, พันธบัตร", "SPY"])
  })

  test("ชื่อที่มีเครื่องหมายคำพูดถูก escape ให้อ่านกลับได้", () => {
    const out = lines(build([{ month: "2015-01", values: [0.01], benchmark: 0.02 }], ['พอร์ต "หลัก"']))
    expect(parseCsvLine(out[2])[1]).toBe('พอร์ต "หลัก"')
  })

  test("EC-CMP-31 เดือนที่ผลตอบแทนเป็นศูนย์พอดี เป็น 0 ในไฟล์ ไม่ใช่ช่องว่าง", () => {
    const out = lines(build([{ month: "2015-01", values: [0], benchmark: 0 }], ["ผสม"]))
    expect(out[3]).toBe("2015-01,0,0")
  })

  test("ค่าที่ไม่มีเป็นช่องว่าง ไม่ใช่ศูนย์", () => {
    const out = lines(build([{ month: "2015-01", values: [null], benchmark: null }], ["ผสม"]))
    expect(out[3]).toBe("2015-01,,")
  })

  test("EC-CMP-28 พอร์ตเดียวได้สองคอลัมน์คือพอร์ตกับตัวเทียบ", () => {
    const out = lines(build([{ month: "2015-01", values: [0.01], benchmark: 0.02 }], ["ผสม"]))
    expect(parseCsvLine(out[2])).toHaveLength(2 + 1)
  })

  test("EC-CMP-27 ช่วงสั้นมากก็ยังได้ไฟล์ตามปกติ", () => {
    const rows: MonthlyRow[] = [
      { month: "2015-01", values: [0.01], benchmark: 0.02 },
      { month: "2015-02", values: [-0.01], benchmark: 0.0 },
    ]
    expect(lines(build(rows, ["ผสม"]))).toHaveLength(3 + 2)
  })

  test("EC-CMP-30 เรียกซ้ำได้เนื้อไฟล์เหมือนกันทุกครั้ง", () => {
    const rows: MonthlyRow[] = [{ month: "2015-01", values: [0.01], benchmark: 0.02 }]
    expect(build(rows, ["ผสม"])).toBe(build(rows, ["ผสม"]))
  })

  test("BR-CMP-78 ชื่อไฟล์บอกได้ว่าเป็นผลของอะไร และไม่มีอักขระที่ระบบไฟล์ไม่รับ", () => {
    const name = csvFileName({ start: "2012-01", end: "2026-06" }, "ผลตอบแทนรายเดือน")

    expect(name).toBe("ผลตอบแทนรายเดือน-2012-01-2026-06.csv")
    expect(name).not.toMatch(/[/\\:*?"<>|]/)
  })

  test("ชื่อไฟล์ที่มีช่องว่างหรืออักขระต้องห้าม ถูกแทนด้วยขีด", () => {
    expect(csvFileName({ start: "2015-01", end: "2015-12" }, "monthly returns / raw")).toBe(
      "monthly-returns-raw-2015-01-2015-12.csv",
    )
  })
})

/** ตัวอ่านไฟล์อย่างง่าย เอาไว้พิสูจน์ว่าหัวคอลัมน์ที่ครอบไว้อ่านกลับได้ถูกจริง */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let quoted = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        current += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      fields.push(current)
      current = ""
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}
