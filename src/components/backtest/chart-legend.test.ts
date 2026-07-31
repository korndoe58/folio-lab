import { describe, expect, test } from "vitest"
import {
  benchmarkBar,
  benchmarkLine,
  contributionLine,
  portfolioBar,
  portfolioLine,
  type LegendItem,
} from "./chart-legend"
import {
  BENCHMARK_DASH,
  CONTRIBUTION_DASH,
  barOpacity,
  lineDash,
  lineWidth,
} from "./series-style"

/** ตัวช่วยอ่านค่าออกจาก union โดยไม่ต้องเขียน guard ซ้ำทุกข้อ */
function asLine(item: LegendItem) {
  if (item.kind !== "line") throw new Error(`คาดว่าเป็นเส้น แต่ได้ ${item.kind}`)
  return item
}
function asBar(item: LegendItem) {
  if (item.kind !== "bar") throw new Error(`คาดว่าเป็นแท่ง แต่ได้ ${item.kind}`)
  return item
}

/**
 * ป้ายกำกับต้องวาดด้วยค่าเดียวกับที่กราฟใช้จริง (BR-LOOP-03, BR-LOOP-07)
 *
 * ชุดนี้คือตัวจับว่าป้ายกับกราฟเพี้ยนออกจากกัน — ถ้าใครแก้ลายใน `series-style.ts`
 * แล้วเผลอเขียนลายซ้ำในป้าย ชุดนี้จะแดงทันที
 */
describe("ตัวสร้างรายการป้ายรับลายจาก series-style ที่เดียว", () => {
  test("เส้นของพอร์ตแต่ละลำดับใช้ลายและความหนาตรงกับที่กราฟวาด", () => {
    for (const index of [0, 1, 2]) {
      const item = asLine(portfolioLine(`พอร์ต ${index + 1}`, index))
      expect(item.dash).toBe(lineDash(index))
      expect(item.width).toBe(lineWidth(index))
      expect(item.label).toBe(`พอร์ต ${index + 1}`)
    }
  })

  test("แท่งของพอร์ตแต่ละลำดับใช้ความทึบตรงกับที่กราฟวาด", () => {
    for (const index of [0, 1, 2]) {
      expect(asBar(portfolioBar("พอร์ต", index)).opacity).toBe(barOpacity(index))
    }
  })

  test("ตัวเทียบและเงินที่ใส่สะสมใช้ลายชุดเดิมและเป็นสีจาง", () => {
    const benchmark = asLine(benchmarkLine("ตลาด (SPY)"))
    expect(benchmark.dash).toBe(BENCHMARK_DASH)
    expect(benchmark.muted).toBe(true)

    const contribution = asLine(contributionLine("เงินที่ใส่สะสม"))
    expect(contribution.dash).toBe(CONTRIBUTION_DASH)
    expect(contribution.muted).toBe(true)

    // แท่งตัวเทียบในกราฟรายปีเป็นกรอบเปล่า จึงไม่ถมสี
    const bar = asBar(benchmarkBar("ตลาด (SPY)"))
    expect(bar.opacity).toBe(0)
    expect(bar.outline).toBe(true)
    expect(bar.muted).toBe(true)
  })

  test("พอร์ตลำดับแรกเป็นเส้นทึบ และสามลำดับใช้ลายที่ต่างกันจริง", () => {
    expect(asLine(portfolioLine("พอร์ต 1", 0)).dash).toBeUndefined()

    // ถ้าสามลายไม่ต่างกัน ป้ายก็บอกอะไรไม่ได้ — ข้อนี้กันการเผลอทำให้ลายซ้ำกัน
    const dashes = [0, 1, 2].map((i) => asLine(portfolioLine("พอร์ต", i)).dash)
    expect(new Set(dashes).size).toBe(3)
  })

  test("ความทึบของแท่งสามลำดับต่างกันจริง", () => {
    const opacities = [0, 1, 2].map((i) => asBar(portfolioBar("พอร์ต", i)).opacity)
    expect(new Set(opacities).size).toBe(3)
  })
})
