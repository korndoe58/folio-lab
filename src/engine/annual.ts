import { parseYearMonth, type MonthlyReturn } from "@/types/series"

export type AnnualReturn = {
  year: number
  value: number
  /** true เมื่อปีนั้นมีข้อมูลไม่ครบ 12 เดือน */
  partial: boolean
  monthsCovered: number
  firstMonth: string
  lastMonth: string
}

/**
 * ผลตอบแทนรายปี (BR-ENG-12) — ผลคูณต่อเนื่องของ (1 + ผลตอบแทนรายเดือน) ในปีนั้น แล้วลบหนึ่ง
 * ปีที่มีเดือนไม่ครบคำนวณจากเดือนที่มี และถูกทำเครื่องหมายว่าเป็นปีไม่เต็ม
 */
export function annualReturns(returns: MonthlyReturn[]): AnnualReturn[] {
  const byYear = new Map<number, MonthlyReturn[]>()
  for (const item of returns) {
    const { year } = parseYearMonth(item.month)
    const bucket = byYear.get(year)
    if (bucket) bucket.push(item)
    else byYear.set(year, [item])
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, months]) => {
      const compounded = months.reduce((acc, m) => acc * (1 + m.value), 1) - 1
      return {
        year,
        value: compounded,
        partial: months.length < 12,
        monthsCovered: months.length,
        firstMonth: months[0].month,
        lastMonth: months[months.length - 1].month,
      }
    })
}

/**
 * ปีที่ดีที่สุดและแย่ที่สุด — พิจารณาเฉพาะปีเต็มตาม BR-ENG-12
 * ไม่มีปีเต็มเลย → ไม่มีค่า ไม่ใช่ 0 (BR-ENG-15)
 */
export function bestWorstFullYears(annual: AnnualReturn[]): {
  best: AnnualReturn | null
  worst: AnnualReturn | null
} {
  const fullYears = annual.filter((a) => !a.partial)
  if (fullYears.length === 0) return { best: null, worst: null }

  let best = fullYears[0]
  let worst = fullYears[0]
  for (const year of fullYears) {
    if (year.value > best.value) best = year
    if (year.value < worst.value) worst = year
  }
  return { best, worst }
}
