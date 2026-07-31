import { describe, expect, test } from "vitest"
import type { MonthlyReturn } from "@/types/series"
import { portfolioReturns } from "./portfolio"
import { decomposePortfolio, type DecomposeAsset } from "./decompose"

/**
 * แยกส่วนผลตอบแทนและความเสี่ยง (US-29) — ทุกค่ามาจากชุดคำนวณมือ
 * เพราะภาคผนวก A ไม่มีเมทริกนี้ (BR-RSK-02)
 *
 * **ชุด ก กับ ข พิสูจน์ตัวหารไม่ได้** เพราะเป็นสัดส่วนที่ตัวหารตัดกัน
 * ชุด ค คือชุดที่จับหัวใจของการ์ด: น้ำหนักเท่ากันแต่ความเสี่ยงไม่เท่ากัน
 */

/** สร้างชุดผลตอบแทนรายเดือนจากรายการค่า */
function series(list: number[]): MonthlyReturn[] {
  return list.map((value, i) => ({
    month: `20${String(20 + Math.floor(i / 12)).padStart(2, "0")}-${String((i % 12) + 1).padStart(2, "0")}` as MonthlyReturn["month"],
    value,
  }))
}

/**
 * เดินพอร์ตจริงเพื่อเอา **น้ำหนักรายเดือนกับชุดผลตอบแทนที่สอดคล้องกัน** มาใช้
 * ปรับสมดุลรายเดือนเพื่อให้น้ำหนักคงที่ตามเป้าตลอด ชุดคำนวณมือจึงไล่ด้วยกระดาษได้
 */
function decompose(assets: Array<{ label: string; weight: number; values: number[] }>, profit?: number) {
  const result = portfolioReturns(
    assets.map((a) => ({ symbol: a.label, weight: a.weight, returns: series(a.values) })),
    { rebalance: "monthly" },
  )
  const total = assets.reduce((sum, a) => sum + a.weight, 0)
  const spec: DecomposeAsset[] = assets.map((a) => ({
    label: a.label,
    targetWeight: a.weight / total,
    returns: series(a.values),
  }))
  return decomposePortfolio({
    assets: spec,
    monthlyWeights: result.weights,
    portfolio: result.returns,
    profit,
  })
}

describe("AC-RSK-25..28 ชุดคำนวณมือของการแยกส่วน", () => {
  test("ชุด ก · ตัวที่ไม่ขยับเลยไม่ได้ทั้งผลตอบแทนและความเสี่ยง", () => {
    const rows = decompose([
      { label: "โต", weight: 60, values: [0.02, -0.01, 0.03, 0.01] },
      { label: "นิ่ง", weight: 40, values: [0, 0, 0, 0] },
    ])

    expect(rows[0].returnShare).toBeCloseTo(1, 10)
    expect(rows[1].returnShare).toBeCloseTo(0, 10)
    expect(rows[0].riskShare).toBeCloseTo(1, 10)
    expect(rows[1].riskShare).toBeCloseTo(0, 10)
  })

  test("ชุด ข · ของที่เหมือนกันทุกอย่างแบ่งเท่ากัน", () => {
    const values = [0.02, -0.01, 0.03, 0.01]
    const rows = decompose([
      { label: "ก", weight: 50, values },
      { label: "ข", weight: 50, values },
    ])

    expect(rows[0].returnShare).toBeCloseTo(0.5, 10)
    expect(rows[1].returnShare).toBeCloseTo(0.5, 10)
    expect(rows[0].riskShare).toBeCloseTo(0.5, 10)
    expect(rows[1].riskShare).toBeCloseTo(0.5, 10)
  })

  test("★ ชุด ค · น้ำหนักเท่ากัน 50/50 แต่ส่วนแบ่งความเสี่ยงเป็น 66.7% กับ 33.3%", () => {
    // ตัวแรกเหวี่ยงเป็นสองเท่าของตัวที่สอง ไปทางเดียวกัน
    const base = [0.02, -0.01, 0.03, 0.01]
    const rows = decompose([
      { label: "เหวี่ยงแรง", weight: 50, values: base.map((v) => v * 2) },
      { label: "เหวี่ยงเบา", weight: 50, values: base },
    ])

    // หัวใจของการ์ดนี้ — น้ำหนักที่กรอกไม่ได้บอกความเสี่ยงที่รับจริง
    expect(rows[0].targetWeight).toBeCloseTo(0.5, 10)
    expect(rows[1].targetWeight).toBeCloseTo(0.5, 10)
    expect(rows[0].riskShare).toBeCloseTo(2 / 3, 6)
    expect(rows[1].riskShare).toBeCloseTo(1 / 3, 6)
    expect(rows[0].riskShare! + rows[1].riskShare!).toBeCloseTo(1, 10)
  })

  test("★ ชุด ง · ตัวที่วิ่งสวนทางได้ส่วนแบ่งความเสี่ยงติดลบ และผลรวมยังเป็น 100%", () => {
    /**
     * ตัวที่สองวิ่งสวนทางด้วยขนาดครึ่งหนึ่ง — ไล่มือได้:
     * `rp = 0.5x − 0.25x = 0.25x` · `risk₁ = 0.5 × 0.25/0.0625 = 2` · `risk₂ = 0.5 × (−0.125)/0.0625 = −1`
     *
     * ถ้าสวนทางกันสนิทด้วยขนาดเท่ากัน ความแปรปรวนของพอร์ตจะเป็นศูนย์
     * และทุกค่าต้องเป็นไม่มีค่าแทน (BR-RSK-41) ซึ่งทดสอบแยกข้างล่าง
     */
    const base = [0.02, -0.01, 0.03, 0.01]
    const rows = decompose([
      { label: "ตามทาง", weight: 50, values: base },
      { label: "สวนทาง", weight: 50, values: base.map((v) => -v / 2) },
    ])

    expect(rows[0].riskShare).toBeCloseTo(2, 6)
    expect(rows[1].riskShare).toBeCloseTo(-1, 6)
    expect(rows[0].riskShare! + rows[1].riskShare!).toBeCloseTo(1, 10)
  })

  test("BR-RSK-36 ส่วนแบ่งกำไรแปลงเป็นเงินได้ และรวมกันเท่ากับกำไรทั้งก้อน", () => {
    const base = [0.02, -0.01, 0.03, 0.01]
    const rows = decompose(
      [
        { label: "ก", weight: 60, values: base.map((v) => v * 2) },
        { label: "ข", weight: 40, values: base },
      ],
      5000,
    )

    const total = rows.reduce((sum, r) => sum + (r.contributionAmount ?? 0), 0)
    expect(total).toBeCloseTo(5000, 6)
  })
})

describe("EC-RSK ค่าที่คำนวณไม่ได้", () => {
  test("ความแปรปรวนของพอร์ตเป็นศูนย์ → ส่วนแบ่งความเสี่ยงไม่มีค่า (BR-RSK-41)", () => {
    const base = [0.02, -0.01, 0.03, 0.01]
    const rows = decompose([
      { label: "ตามทาง", weight: 50, values: base },
      { label: "สวนทางสนิท", weight: 50, values: base.map((v) => -v) },
    ])

    expect(rows[0].riskShare).toBeNull()
    expect(rows[1].riskShare).toBeNull()
  })

  test("ไม่ส่งกำไรมา → ไม่คิดส่วนที่เป็นเงิน", () => {
    const rows = decompose([
      { label: "ก", weight: 50, values: [0.01, 0.02, -0.01, 0.03] },
      { label: "ข", weight: 50, values: [0.02, -0.01, 0.01, 0.01] },
    ])
    expect(rows[0].contributionAmount).toBeNull()
  })
})
