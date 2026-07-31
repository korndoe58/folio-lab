import type { MonthlyReturn, YearMonth } from "@/types/series"
import { mean, sampleStdev } from "./metrics"

/**
 * ความสัมพันธ์ระหว่างสินทรัพย์ (US-28)
 *
 * รับรายการสินทรัพย์เข้ามาตรง ๆ ไม่ผ่าน `portfolioReturns`
 * ([PD-020](../../docs/product/decision-log.md)) — ส่วนนี้ไม่เกี่ยวกับการเดินมูลค่าเลย
 *
 * ตัวหาร `n−1` ของทั้งความแปรปรวนร่วมและส่วนเบี่ยงเบน **ตัดกันหมด**ในสูตรนี้
 * ผลจึงเท่ากันไม่ว่าจะใช้ `n` หรือ `n−1` · ต่างจากการแยกส่วนความเสี่ยง (US-29)
 * ที่ตัวหารมีผลจริง (BR-RSK-38)
 */

export type CorrelationSeries = {
  /** ชื่อที่จะขึ้นบนหัวแถวและหัวคอลัมน์ */
  label: string
  returns: MonthlyReturn[]
}

export type CorrelationMatrix = {
  labels: string[]
  /**
   * ตารางสามเหลี่ยมล่าง — `rows[i][j]` มีค่าเมื่อ `j <= i` เท่านั้น
   * ครึ่งบนซ้ำกับครึ่งล่างจึงไม่ต้องเก็บ (BR-RSK-29)
   */
  rows: Array<Array<number | null>>
}

/** จับคู่สองชุดตามเดือน — เทียบเฉพาะเดือนที่มีข้อมูลครบทั้งคู่ */
function pairByMonth(a: MonthlyReturn[], b: MonthlyReturn[]): { a: number[]; b: number[] } {
  const byMonth = new Map<YearMonth, number>()
  for (const item of b) byMonth.set(item.month, item.value)

  const left: number[] = []
  const right: number[] = []
  for (const item of a) {
    const other = byMonth.get(item.month)
    if (other === undefined) continue
    left.push(item.value)
    right.push(other)
  }
  return { a: left, b: right }
}

/**
 * สองชุดขยับไปทางเดียวกันแค่ไหน — อยู่ระหว่าง `−1` ถึง `+1` ไร้หน่วย (BR-RSK-27)
 * ชุดที่ไม่ขยับเลย → ส่วนเบี่ยงเบนเป็นศูนย์ → **ไม่มีค่า ไม่ใช่ศูนย์** (BR-RSK-31)
 */
export function correlation(a: MonthlyReturn[], b: MonthlyReturn[]): number | null {
  const paired = pairByMonth(a, b)
  if (paired.a.length < 2) return null

  const stdevA = sampleStdev(paired.a)
  const stdevB = sampleStdev(paired.b)
  if (stdevA === null || stdevB === null || stdevA === 0 || stdevB === 0) return null

  const meanA = mean(paired.a)
  const meanB = mean(paired.b)
  const covariance =
    paired.a.reduce((sum, value, i) => sum + (value - meanA) * (paired.b[i] - meanB), 0) /
    (paired.a.length - 1)

  return covariance / (stdevA * stdevB)
}

/** ตารางสามเหลี่ยมของทุกคู่ · เส้นทแยงมุมเป็น `1` เสมอตามนิยาม (BR-RSK-30) */
export function correlationMatrix(series: CorrelationSeries[]): CorrelationMatrix {
  return {
    labels: series.map((item) => item.label),
    rows: series.map((rowSeries, i) =>
      series.slice(0, i + 1).map((columnSeries, j) => {
        if (i === j) return 1
        return correlation(rowSeries.returns, columnSeries.returns)
      }),
    ),
  }
}
