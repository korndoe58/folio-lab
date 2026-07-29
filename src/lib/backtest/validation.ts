import {
  MAX_AMOUNT,
  MIN_AMOUNT,
  SYMBOL_PATTERN,
  WEIGHT_SUM_TOLERANCE,
  type BacktestConfig,
  type PortfolioRow,
} from "@/types/backtest"

/** รหัสข้อความจาก docs/product/_shared/validation-glossary.md */
export type ValidationCode =
  | "V-001"
  | "V-002"
  | "V-003"
  | "V-004"
  | "V-005"
  | "V-006"
  | "V-007"
  | "V-008"
  | "V-010"

export type ValidationIssue = {
  code: ValidationCode
  /** ค่าที่เติมลงข้อความ เช่น {sum} {symbol} {lastMonth} */
  params?: Record<string, string>
}

export type FormIssues = {
  /** ปัญหาระดับแถวสินทรัพย์ ดัชนีตรงกับลำดับแถวในฟอร์ม */
  rows: Array<ValidationIssue | null>
  startYear: ValidationIssue | null
  endYear: ValidationIssue | null
  amount: ValidationIssue | null
  benchmark: ValidationIssue | null
  /** ปัญหาที่ข้ามหลายช่อง แสดงเหนือปุ่ม (BR-CFG-12) */
  form: ValidationIssue | null
}

export const NO_ISSUES: FormIssues = {
  rows: [],
  startYear: null,
  endYear: null,
  amount: null,
  benchmark: null,
  form: null,
}

export function hasIssues(issues: FormIssues): boolean {
  return (
    issues.rows.some(Boolean) ||
    issues.startYear !== null ||
    issues.endYear !== null ||
    issues.amount !== null ||
    issues.benchmark !== null ||
    issues.form !== null
  )
}

export function filledRows(assets: PortfolioRow[]): PortfolioRow[] {
  return assets.filter((row) => row.symbol.trim() !== "")
}

/** ผลรวมน้ำหนักของแถวที่กรอกสัญลักษณ์แล้ว */
export function weightSum(assets: PortfolioRow[]): number {
  return filledRows(assets).reduce((sum, row) => sum + (Number(row.weight) || 0), 0)
}

/**
 * ตรวจฟอร์มทั้งชุด (BR-CFG-03..10)
 *
 * `unknownSymbols` คือสัญลักษณ์ที่ชั้นข้อมูลตอบว่าไม่มี — ส่งเข้ามาเพราะการตรวจนี้เป็นฟังก์ชันบริสุทธิ์
 * ไม่ไปเรียกข้อมูลเอง
 */
export function validateConfig(
  config: BacktestConfig,
  context: { lastClosedYear: number; unknownSymbols?: Set<string> },
): FormIssues {
  const unknown = context.unknownSymbols ?? new Set<string>()
  const issues: FormIssues = { ...NO_ISSUES, rows: config.assets.map(() => null) }

  const seen = new Set<string>()
  config.assets.forEach((row, index) => {
    const symbol = row.symbol.trim().toUpperCase()
    if (symbol === "") {
      // แถวว่างไม่ถือว่าผิด ผู้ใช้แค่ยังไม่กรอก
      if (row.weight.trim() !== "" && !isValidWeight(row.weight)) {
        issues.rows[index] = { code: "V-007" }
      }
      return
    }

    if (!SYMBOL_PATTERN.test(symbol) || unknown.has(symbol)) {
      issues.rows[index] = { code: "V-003", params: { symbol } }
      return
    }
    if (seen.has(symbol)) {
      issues.rows[index] = { code: "V-010" }
      return
    }
    seen.add(symbol)

    if (!isValidWeight(row.weight)) {
      issues.rows[index] = { code: "V-007" }
    }
  })

  const filled = filledRows(config.assets)
  if (filled.length === 0) {
    issues.form = { code: "V-002" }
  } else if (!issues.rows.some(Boolean)) {
    // ตรวจผลรวมเมื่อทุกแถวมีน้ำหนักที่ใช้ได้แล้วเท่านั้น จะได้ไม่แสดงสองข้อความพร้อมกัน
    const sum = weightSum(config.assets)
    // เผื่อความคลาดของการเก็บทศนิยมในเครื่อง (33.33 สามตัวรวมกันได้ 99.98999…)
    // ไม่ให้พลิกผลของค่าที่คลาดพอดี 0.01 ซึ่งการ์ดระบุว่ายอมรับได้
    if (Math.abs(sum - 100) > WEIGHT_SUM_TOLERANCE + 1e-9) {
      issues.form = { code: "V-001", params: { sum: formatSum(sum) } }
    }
  }

  if (config.startYear > config.endYear) {
    issues.endYear = { code: "V-004" }
  }
  if (config.endYear > context.lastClosedYear) {
    issues.endYear = { code: "V-005" }
  }

  if (
    !Number.isFinite(config.amount) ||
    config.amount < MIN_AMOUNT ||
    config.amount > MAX_AMOUNT ||
    !Number.isInteger(config.amount)
  ) {
    issues.amount = { code: "V-006" }
  }

  const benchmark = config.benchmark.trim().toUpperCase()
  if (!SYMBOL_PATTERN.test(benchmark) || unknown.has(benchmark)) {
    issues.benchmark = { code: "V-003", params: { symbol: benchmark } }
  }

  return issues
}

function isValidWeight(raw: string): boolean {
  const trimmed = raw.trim()
  if (trimmed === "") return false
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0 || value > 100) return false
  // ทศนิยมไม่เกิน 2 ตำแหน่ง (BR-CFG-04)
  return /^\d+(\.\d{1,2})?$/.test(trimmed)
}

function formatSum(sum: number): string {
  return Number.isInteger(sum) ? String(sum) : sum.toFixed(2).replace(/\.?0+$/, "")
}

/**
 * เฉลี่ยน้ำหนักให้เท่ากันโดยผลรวมเป็น 100 พอดี (BR-CFG-14)
 * เศษที่หารไม่ลงตัวถูกยกให้แถวแรก เช่น 3 แถว → 33.34 / 33.33 / 33.33
 */
export function evenWeights(count: number): string[] {
  if (count <= 0) return []
  const base = Math.floor((100 / count) * 100) / 100
  const weights = Array.from({ length: count }, () => base)
  const remainder = Math.round((100 - base * count) * 100) / 100
  weights[0] = Math.round((weights[0] + remainder) * 100) / 100
  return weights.map((w) => String(w))
}
