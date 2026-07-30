import {
  CURRENCY_OPTIONS,
  DEFAULT_AMOUNT,
  DEFAULT_BASE_CURRENCY,
  DEFAULT_BENCHMARK,
  DEFAULT_YEARS_BACK,
  LEGACY_LINK_CURRENCY,
  MAX_ASSETS,
  type BacktestConfig,
  type PortfolioRow,
} from "@/types/backtest"
import type { Currency } from "@/data/currency"

/**
 * แปลงค่าที่ตั้งไว้ไปกลับกับลิงก์ (US-06)
 *
 * `V-008` ใช้เฉพาะเมื่อ **อ่านโครงสร้างไม่ออก** ตาม BR-URL-06 — ค่าที่อ่านออกแต่ผิดกฎของฟอร์ม
 * (น้ำหนักรวมไม่ครบ, สัญลักษณ์ไม่มีข้อมูล, ปีสลับ) ส่งต่อให้การตรวจของฟอร์มจัดการตามปกติ
 */
export type DecodeResult =
  | { ok: true; config: BacktestConfig }
  /** โครงสร้างเสีย — เติมเท่าที่อ่านได้ลงฟอร์มแล้วแจ้ง V-008 */
  | { ok: false; partial: BacktestConfig }

export type UrlParams = {
  get(name: string): string | null
}

export function defaultConfig(lastClosedYear: number): BacktestConfig {
  return {
    assets: [emptyRow(), emptyRow()],
    startYear: lastClosedYear - DEFAULT_YEARS_BACK,
    endYear: lastClosedYear,
    amount: DEFAULT_AMOUNT,
    benchmark: DEFAULT_BENCHMARK,
    baseCurrency: DEFAULT_BASE_CURRENCY,
  }
}

export function emptyRow(): PortfolioRow {
  return { symbol: "", weight: "" }
}

/** ลิงก์ไม่มีค่าใดเลยหรือไม่ — กรณีนี้ถือเป็นฟอร์มเปล่าปกติ ไม่ใช่ข้อผิดพลาด (EC-URL-01) */
export function isEmptyParams(params: UrlParams): boolean {
  return ["assets", "start", "end", "amount", "benchmark", "base"].every((k) => params.get(k) === null)
}

export function decodeConfig(params: UrlParams, lastClosedYear: number): DecodeResult {
  const fallback = defaultConfig(lastClosedYear)
  const rawAssets = params.get("assets")

  const assets = rawAssets === null ? null : parseAssets(rawAssets)
  const startYear = parseYear(params.get("start"))
  const endYear = parseYear(params.get("end"))
  const amount = parseAmount(params.get("amount"))
  const benchmark = params.get("benchmark")?.trim().toUpperCase() || null
  const rawBase = params.get("base")
  const base = parseCurrency(rawBase)

  const config: BacktestConfig = {
    assets: assets?.rows.length ? assets.rows : fallback.assets,
    startYear: startYear ?? fallback.startYear,
    endYear: endYear ?? fallback.endYear,
    amount: amount ?? fallback.amount,
    benchmark: benchmark ?? fallback.benchmark,
    // ลิงก์ที่ไม่ระบุสกุลเงินคือลิงก์ที่แชร์ไปก่อนมีตัวเลือกนี้ จึงต้องเป็นดอลลาร์เหมือนเดิม (BR-CUR-03)
    baseCurrency: base ?? LEGACY_LINK_CURRENCY,
  }

  const structurallyBroken =
    (assets?.broken ?? false) ||
    (rawAssets !== null && assets !== null && assets.rows.length === 0) ||
    (rawAssets !== null && (assets?.rows.length ?? 0) > MAX_ASSETS) ||
    (params.get("start") !== null && startYear === null) ||
    (params.get("end") !== null && endYear === null) ||
    (params.get("amount") !== null && amount === null) ||
    // สกุลเงินที่ไม่รู้จักถือว่าอ่านโครงสร้างไม่ออก (EC-CUR-01)
    (rawBase !== null && base === null)

  return structurallyBroken ? { ok: false, partial: config } : { ok: true, config }
}

export function encodeConfig(config: BacktestConfig): string {
  const assets = config.assets
    .filter((row) => row.symbol.trim() !== "")
    .map((row) => `${row.symbol.trim().toUpperCase()}:${row.weight.trim()}`)
    .join(",")

  const query = new URLSearchParams({
    assets,
    start: String(config.startYear),
    end: String(config.endYear),
    amount: String(config.amount),
    benchmark: config.benchmark.trim().toUpperCase(),
    base: config.baseCurrency,
  })
  // URLSearchParams เข้ารหัส , และ : ซึ่งอ่านยากในแถบที่อยู่ — คืนกลับให้อ่านออก
  return query.toString().replace(/%2C/g, ",").replace(/%3A/g, ":")
}

function parseCurrency(raw: string | null): Currency | null {
  if (raw === null) return null
  const value = raw.trim().toUpperCase()
  return CURRENCY_OPTIONS.includes(value as Currency) ? (value as Currency) : null
}

type ParsedAssets = { rows: PortfolioRow[]; broken: boolean }

function parseAssets(raw: string): ParsedAssets {
  const rows: PortfolioRow[] = []
  let broken = false

  for (const chunk of raw.split(",")) {
    const piece = chunk.trim()
    // ตัวคั่นเกินหรือช่องว่างล้วน ให้ข้ามไปโดยไม่ถือว่าโครงสร้างเสีย (EC-URL-04)
    if (piece === "") continue

    const parts = piece.split(":")
    if (parts.length !== 2) {
      broken = true
      continue
    }
    const [symbol, weight] = parts.map((p) => p.trim())
    if (symbol === "" || weight === "" || !Number.isFinite(Number(weight))) {
      broken = true
      continue
    }
    rows.push({ symbol: symbol.toUpperCase(), weight })
  }

  if (rows.length > MAX_ASSETS) broken = true
  return { rows, broken }
}

function parseYear(raw: string | null): number | null {
  if (raw === null) return null
  const value = Number(raw.trim())
  if (!Number.isInteger(value) || value < 1900 || value > 2200) return null
  return value
}

function parseAmount(raw: string | null): number | null {
  if (raw === null) return null
  const value = Number(raw.trim())
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}
