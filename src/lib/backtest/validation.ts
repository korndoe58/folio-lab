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
  | "V-013"

export type ValidationIssue = {
  code: ValidationCode
  /** ค่าที่เติมลงข้อความ เช่น {sum} {symbol} {lastMonth} */
  params?: Record<string, string>
}

/** ปัญหาของพอร์ตหนึ่งชุด — แยกรายพอร์ตเพื่อให้ข้อความชี้ได้ว่าเป็นของพอร์ตไหน (BR-CMP-18) */
export type PortfolioIssues = {
  /** ปัญหาระดับแถวสินทรัพย์ ดัชนีตรงกับลำดับแถวในพอร์ตนั้น */
  rows: Array<ValidationIssue | null>
  /** ปัญหาระดับพอร์ต เช่น น้ำหนักรวมไม่ครบ ไม่มีสินทรัพย์ หรือชื่อซ้ำ */
  portfolio: ValidationIssue | null
}

export type FormIssues = {
  /** ดัชนีตรงกับลำดับพอร์ตในฟอร์ม */
  portfolios: PortfolioIssues[]
  startYear: ValidationIssue | null
  endYear: ValidationIssue | null
  amount: ValidationIssue | null
  benchmark: ValidationIssue | null
  /** ปัญหาที่ข้ามหลายช่อง แสดงเหนือปุ่ม (BR-CFG-12) */
  form: ValidationIssue | null
}

export const NO_ISSUES: FormIssues = {
  portfolios: [],
  startYear: null,
  endYear: null,
  amount: null,
  benchmark: null,
  form: null,
}

export const NO_PORTFOLIO_ISSUES: PortfolioIssues = { rows: [], portfolio: null }

export function hasIssues(issues: FormIssues): boolean {
  return (
    issues.portfolios.some((p) => p.rows.some(Boolean) || p.portfolio !== null) ||
    issues.startYear !== null ||
    issues.endYear !== null ||
    issues.amount !== null ||
    issues.benchmark !== null ||
    issues.form !== null
  )
}

/** ปัญหาของพอร์ตลำดับนั้น หรือชุดว่างเมื่อยังไม่เคยตรวจ — กันไม่ให้หน้าจอต้องเช็ค undefined เอง */
export function portfolioIssuesAt(issues: FormIssues, index: number): PortfolioIssues {
  return issues.portfolios[index] ?? NO_PORTFOLIO_ISSUES
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
  const issues: FormIssues = {
    ...NO_ISSUES,
    portfolios: config.portfolios.map((portfolio) => ({
      rows: portfolio.assets.map(() => null),
      portfolio: null,
    })),
  }

  // ชื่อที่ปรากฏมากกว่าหนึ่งครั้ง — เทียบแบบตัดช่องว่างหัวท้ายและไม่สนตัวพิมพ์ (BR-CMP-17)
  const nameCount = new Map<string, number>()
  for (const portfolio of config.portfolios) {
    const key = portfolio.name.trim().toLowerCase()
    if (key === "") continue
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1)
  }

  config.portfolios.forEach((portfolio, pIndex) => {
    const target = issues.portfolios[pIndex]

    // สัญลักษณ์ห้ามซ้ำ **ภายในพอร์ตเดียวกัน** เท่านั้น — ซ้ำข้ามพอร์ตคือประเด็นของการเทียบ (BR-CMP-19)
    const seen = new Set<string>()
    portfolio.assets.forEach((row, index) => {
      const symbol = row.symbol.trim().toUpperCase()
      if (symbol === "") {
        // แถวว่างไม่ถือว่าผิด ผู้ใช้แค่ยังไม่กรอก
        if (row.weight.trim() !== "" && !isValidWeight(row.weight)) {
          target.rows[index] = { code: "V-007" }
        }
        return
      }

      if (!SYMBOL_PATTERN.test(symbol) || unknown.has(symbol)) {
        target.rows[index] = { code: "V-003", params: { symbol } }
        return
      }
      if (seen.has(symbol)) {
        target.rows[index] = { code: "V-010" }
        return
      }
      seen.add(symbol)

      if (!isValidWeight(row.weight)) {
        target.rows[index] = { code: "V-007" }
      }
    })

    if ((nameCount.get(portfolio.name.trim().toLowerCase()) ?? 0) > 1) {
      target.portfolio = { code: "V-013" }
      return
    }

    const filled = filledRows(portfolio.assets)
    if (filled.length === 0) {
      target.portfolio = { code: "V-002" }
    } else if (!target.rows.some(Boolean)) {
      // ตรวจผลรวมเมื่อทุกแถวมีน้ำหนักที่ใช้ได้แล้วเท่านั้น จะได้ไม่แสดงสองข้อความพร้อมกัน
      const sum = weightSum(portfolio.assets)
      // เผื่อความคลาดของการเก็บทศนิยมในเครื่อง (33.33 สามตัวรวมกันได้ 99.98999…)
      // ไม่ให้พลิกผลของค่าที่คลาดพอดี 0.01 ซึ่งการ์ดระบุว่ายอมรับได้
      if (Math.abs(sum - 100) > WEIGHT_SUM_TOLERANCE + 1e-9) {
        target.portfolio = { code: "V-001", params: { sum: formatSum(sum) } }
      }
    }
  })

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
