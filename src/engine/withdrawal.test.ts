import { describe, expect, test } from "vitest"
import type { MonthlyReturn, YearMonth } from "@/types/series"
import { safeWithdrawalRate } from "./withdrawal"

/**
 * อัตราถอนปลอดภัย (US-33) — ทุกค่ามาจากชุดคำนวณมือ เพราะภาคผนวก A ไม่มีเมทริกนี้
 *
 * **ชุด ก ถึง ง พิสูจน์อะไรไม่ได้เรื่องการเลื่อนหน้าต่าง** เพราะผลตอบแทนคงที่ทำให้ทุกหน้าต่าง
 * เหมือนกันหมด — กับดักเดียวกับที่ S16 เจอ · **ชุด จ คือชุดเดียวที่จับได้ว่าใช้หน้าต่าง
 * ที่แย่ที่สุดจริง ไม่ใช่ค่าเฉลี่ย** จึงต้องมีเสมอ
 */

function monthAt(index: number): YearMonth {
  const year = 2000 + Math.floor(index / 12)
  return `${year}-${String((index % 12) + 1).padStart(2, "0")}`
}

/**
 * ต่อช่วงผลตอบแทนหลายช่วงเข้าด้วยกันโดย**เดือนเดินต่อเนื่อง**
 *
 * ห้ามเอาชุดที่สร้างแยกกันมาต่อกันตรง ๆ เพราะเดือนจะเริ่มนับหนึ่งใหม่ทุกชุด →
 * ได้เดือนซ้ำ และชั้นคำนวณที่ทำดัชนีตามเดือนจะยุบให้เหลือชุดเดียว
 * ชุดทดสอบจะดู "ผ่าน" ทั้งที่วัดคนละอย่างกับที่ตั้งใจ
 */
function sequence(...segments: number[][]): MonthlyReturn[] {
  return segments.flat().map((value, i) => ({ month: monthAt(i), value }))
}

const constant = (value: number, months: number) => Array<number>(months).fill(value)

/** ชุดผลตอบแทนคงที่ ยาวตามจำนวนเดือนที่ต้องการ */
const flat = (value: number, months: number) => sequence(constant(value, months))

/** ไม่ปรับเงินเฟ้อ — ชุดคำนวณมือทั้งหมดใช้แบบนี้เพื่อให้ไล่ด้วยกระดาษได้ */
const NO_INFLATION: [] = []

const rateOf = (returns: MonthlyReturn[], years: number) =>
  safeWithdrawalRate({ returns, years, inflationRates: NO_INFLATION })

function expectPercent(actual: number | null, expected: number, label: string) {
  expect(actual, `${label} ต้องมีค่า`).not.toBeNull()
  const actualPct = (actual as number) * 100
  expect(
    Math.abs(actualPct - expected),
    `${label}: คำนวณได้ ${actualPct.toFixed(3)}% เทียบที่คำนวณมือ ${expected}%`,
  ).toBeLessThanOrEqual(0.05)
}

describe("AC-RSK-42..43 ชุดคำนวณมือที่ไล่ด้วยกระดาษได้", () => {
  test("★ ชุด ก · ผลตอบแทนศูนย์ ระยะ 10 ปี → 10.00% พอดี", () => {
    /**
     * เงินไม่โตเลย ถอนเดือนละ `r × เงินตั้งต้น ÷ 12` เป็นเวลา 120 เดือน
     * หมดพอดีเมื่อ `r × 10 = 1` → `r = 10%` · ถ้าถอนมากกว่านี้จะหมดก่อนครบระยะ
     */
    const result = rateOf(flat(0, 120), 10)
    expectPercent(result.rate, 10, "อัตราของชุด ก")
    expect(result.windows, "ข้อมูลยาวเท่าระยะพอดี → มีหน้าต่างเดียว").toBe(1)
  })

  test("ชุด ข · ผลตอบแทนศูนย์ ระยะ 20 ปี → 5.00% (สเกลตามระยะ)", () => {
    expectPercent(rateOf(flat(0, 240), 20).rate, 5, "อัตราของชุด ข")
  })

  test("ชุด ค · เงินที่โตต้องถอนได้มากกว่าเงินที่นิ่ง", () => {
    const growing = rateOf(flat(0.005, 120), 10).rate as number
    const still = rateOf(flat(0, 120), 10).rate as number
    expect(growing).toBeGreaterThan(still)
    expect(growing).toBeGreaterThan(0.1)
  })

  test("ชุด ง · ทุกหน้าต่างเหมือนกัน → อัตราของหน้าต่างเดียวเท่ากับของทุกหน้าต่าง", () => {
    // ข้อมูล 12 ปี ระยะ 10 ปี → 25 หน้าต่าง แต่ผลตอบแทนคงที่จึงเหมือนกันหมด
    const many = rateOf(flat(0, 144), 10)
    const one = rateOf(flat(0, 120), 10)
    expect(many.windows).toBe(25)
    expectPercent(many.rate, (one.rate as number) * 100, "อัตราเมื่อมีหลายหน้าต่าง")
  })
})

describe("★ ชุด จ — หัวใจของนิยาม: ปลอดภัยแปลว่ารอดทุกหน้าต่าง ไม่ใช่รอดโดยเฉลี่ย", () => {
  /**
   * สร้างข้อมูลที่**หน้าต่างแรกแย่กว่าหน้าต่างที่เหลือชัดเจน**:
   * 12 เดือนแรกขาดทุนหนัก แล้วที่เหลือผลตอบแทนศูนย์
   *
   * หน้าต่างที่เริ่มเดือนแรกจะเจอช่วงขาดทุนนั้นเต็ม ๆ ส่วนหน้าต่างที่เริ่มหลังจากนั้นไม่เจอเลย
   * → อัตราที่ปลอดภัยต้องถูกกำหนดโดยหน้าต่างแรก ซึ่งต่ำกว่าอัตราของหน้าต่างหลัง ๆ
   */
  const crashThenFlat = sequence(constant(-0.05, 12), constant(0, 132))

  test("อัตราถูกกำหนดโดยหน้าต่างที่แย่ที่สุด ไม่ใช่ค่าเฉลี่ย", () => {
    const all = rateOf(crashThenFlat, 10)
    // หน้าต่างที่เริ่มหลังช่วงขาดทุน = ผลตอบแทนศูนย์ล้วน → 10%
    const afterCrash = rateOf(crashThenFlat.slice(12), 10)

    expect(all.rate).not.toBeNull()
    expectPercent(afterCrash.rate, 10, "อัตราของหน้าต่างที่ไม่เจอวิกฤต")
    // ★ ข้อพิสูจน์ — ถ้าเผลอใช้ค่าเฉลี่ยหรือหน้าต่างสุดท้าย ข้อนี้จะแดง
    expect(all.rate as number, "อัตรารวมต้องต่ำกว่าอัตราของหน้าต่างที่ไม่เจอวิกฤต").toBeLessThan(
      afterCrash.rate as number,
    )
  })

  test("หน้าต่างที่บีบที่สุดคือหน้าต่างแรกซึ่งเจอช่วงขาดทุนเต็ม ๆ", () => {
    const result = rateOf(crashThenFlat, 10)
    expect(result.worstWindowStart).toBe("2000-01")
    expect(result.windows).toBe(crashThenFlat.length - 120 + 1)
  })
})

describe("EC-RSK-21..24 กรณีขอบ", () => {
  test("EC-RSK-22 พอร์ตที่โตเร็วมากจนถอน 20% ก็ไม่หมด → ชนเพดาน", () => {
    const result = rateOf(flat(0.03, 120), 10)
    expect(result.atCeiling, "ต้องบอกว่าชนเพดาน ไม่ใช่แสดง 20% เหมือนเป็นคำตอบที่แม่น").toBe(true)
    expect(result.rate).toBe(0.2)
  })

  test("EC-RSK-21 พอร์ตที่ขาดทุนหนักตลอด → อัตราเข้าใกล้ศูนย์ แต่ยังแสดงได้", () => {
    const result = rateOf(flat(-0.02, 120), 10)
    expect(result.rate).not.toBeNull()
    expect(result.rate as number).toBeLessThan(0.03)
    expect(result.rate as number).toBeGreaterThanOrEqual(0)
  })

  test("BR-RSK-53 ระยะยาวกว่าช่วงข้อมูล → ไม่มีค่า และไม่มีหน้าต่างให้ทดสอบ", () => {
    const result = rateOf(flat(0, 120), 30)
    expect(result.rate).toBeNull()
    expect(result.windows).toBe(0)
    expect(result.worstWindowStart).toBeNull()
  })

  test("EC-RSK-23 ข้อมูลยาวเท่าระยะพอดี → หน้าต่างเดียว และบอกว่าทดสอบมาแค่หนึ่งกรณี", () => {
    const result = rateOf(flat(0, 120), 10)
    expect(result.windows).toBe(1)
    expect(result.worstWindowStart).toBe("2000-01")
  })
})

describe("BR-RSK-52 การถอนปรับตามเงินเฟ้อ", () => {
  test("เปิดปรับเงินเฟ้อแล้วถอนได้น้อยลง เพราะจำนวนที่ถอนโตขึ้นทุกปี", () => {
    const returns = flat(0, 120)
    const withoutInflation = rateOf(returns, 10).rate as number
    const withInflation = safeWithdrawalRate({
      returns,
      years: 10,
      inflationRates: Array.from({ length: 12 }, (_, i) => ({ year: 2000 + i, value: 0.03 })),
    }).rate as number

    expect(withInflation).toBeLessThan(withoutInflation)
  })
})
