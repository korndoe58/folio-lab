import { describe, expect, test } from "vitest"
import bnd from "@/data/fixtures/bnd.json"
import vnq from "@/data/fixtures/vnq.json"
import vti from "@/data/fixtures/vti.json"
import vxus from "@/data/fixtures/vxus.json"
import type { MonthlyReturn } from "@/types/series"
import { correlation, correlationMatrix } from "./correlation"

/**
 * ความสัมพันธ์ระหว่างสินทรัพย์ (US-28)
 *
 * สามคู่มีค่าอ้างอิงจากต้นแบบ · ที่เหลือใช้ชุดคำนวณมือที่ได้เลขกลม ตรวจด้วยกระดาษได้ทันที
 */
const RATIO_TOLERANCE = 0.01
const returnsOf = (fixture: { returns: MonthlyReturn[] }) => fixture.returns

/** ตัดให้เหลือช่วงร่วมของพอร์ตอ้างอิง (ม.ค. 2012 – มิ.ย. 2026) ก่อนเทียบ */
const RANGE_START = "2012-01"
const RANGE_END = "2026-06"
const clip = (list: MonthlyReturn[]) =>
  list.filter((item) => item.month >= RANGE_START && item.month <= RANGE_END)

function series(list: number[]): MonthlyReturn[] {
  return list.map((value, i) => ({
    month: `20${String(20 + Math.floor(i / 12)).padStart(2, "0")}-${String((i % 12) + 1).padStart(2, "0")}` as MonthlyReturn["month"],
    value,
  }))
}

function expectRatio(actual: number | null, expected: number, label: string) {
  expect(actual, `${label} ต้องมีค่า`).not.toBeNull()
  expect(
    Math.abs((actual as number) - expected),
    `${label}: คำนวณได้ ${(actual as number).toFixed(4)} เทียบอ้างอิง ${expected}`,
  ).toBeLessThanOrEqual(RATIO_TOLERANCE)
}

describe("AC-RSK-17..19 คู่ที่เทียบกับต้นแบบได้", () => {
  test("VTI–VXUS · VTI–BND · VNQ–BND ตรงชุดอ้างอิง", () => {
    expectRatio(correlation(clip(returnsOf(vti)), clip(returnsOf(vxus))), 0.83, "VTI–VXUS")
    expectRatio(correlation(clip(returnsOf(vti)), clip(returnsOf(bnd))), 0.36, "VTI–BND")
    expectRatio(correlation(clip(returnsOf(vnq)), clip(returnsOf(bnd))), 0.6, "VNQ–BND")
  })
})

describe("AC-RSK-20..22 ชุดคำนวณมือที่ได้เลขกลม", () => {
  const rising = series([0.01, 0.02, 0.03, 0.04])

  test("ตัวเองกับตัวเองได้หนึ่งพอดี (BR-RSK-30)", () => {
    expect(correlation(rising, rising)).toBeCloseTo(1, 10)
  })

  test("สวนทางกันสนิทได้ลบหนึ่ง", () => {
    expect(correlation(rising, series([-0.01, -0.02, -0.03, -0.04]))).toBeCloseTo(-1, 10)
  })

  test("★ เหวี่ยงแรงกว่าสองเท่าแต่ไปทางเดียวกัน ยังได้หนึ่ง — ความสัมพันธ์ไม่สนขนาด สนแต่ทิศ", () => {
    expect(correlation(rising, series([0.02, 0.04, 0.06, 0.08]))).toBeCloseTo(1, 10)
  })

  test("ไม่มีความสัมพันธ์กันเลยได้ศูนย์พอดี", () => {
    const a = series([1, -1, 1, -1])
    const b = series([1, 1, -1, -1])
    expect(correlation(a, b)).toBeCloseTo(0, 10)
  })

  test("ตัวที่ไม่ขยับเลย → ไม่มีค่า ไม่ใช่ศูนย์ (BR-RSK-31)", () => {
    expect(correlation(rising, series([0, 0, 0, 0]))).toBeNull()
  })
})

describe("AC-RSK-23..24 ตารางสามเหลี่ยม", () => {
  test("ครึ่งล่างเท่านั้น และเส้นทแยงมุมเป็นหนึ่ง", () => {
    const matrix = correlationMatrix([
      { label: "VTI", returns: clip(returnsOf(vti)) },
      { label: "VXUS", returns: clip(returnsOf(vxus)) },
      { label: "BND", returns: clip(returnsOf(bnd)) },
    ])

    expect(matrix.labels).toEqual(["VTI", "VXUS", "BND"])
    // แถวที่ i มี i+1 ช่อง — ครึ่งบนที่ซ้ำกันไม่ถูกเก็บ (BR-RSK-29)
    expect(matrix.rows.map((r) => r.length)).toEqual([1, 2, 3])
    expect(matrix.rows[0][0]).toBe(1)
    expect(matrix.rows[1][1]).toBe(1)
    expect(matrix.rows[2][2]).toBe(1)
    expectRatio(matrix.rows[1][0], 0.83, "VTI–VXUS ในตาราง")
  })

  test("BR-RSK-34 สินทรัพย์เดียวกับตัวเทียบยังได้ตารางที่มีประโยชน์", () => {
    const matrix = correlationMatrix([
      { label: "VTI", returns: clip(returnsOf(vti)) },
      { label: "SPY", returns: clip(returnsOf(vti)) },
    ])
    expect(matrix.rows).toHaveLength(2)
    expect(matrix.rows[1][0]).toBeCloseTo(1, 10)
  })
})
