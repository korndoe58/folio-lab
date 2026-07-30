import {
  CURRENCY_OPTIONS,
  DEFAULT_AMOUNT,
  DEFAULT_BASE_CURRENCY,
  DEFAULT_BENCHMARK,
  DEFAULT_INFLATION_ADJUSTED,
  DEFAULT_BAND_POINTS,
  DEFAULT_REBALANCE,
  DEFAULT_YEARS_BACK,
  LEGACY_LINK_CURRENCY,
  MAX_ASSETS,
  MAX_PORTFOLIOS,
  MAX_PORTFOLIO_NAME,
  REBALANCE_OPTIONS,
  type BacktestConfig,
  type CashflowSpec,
  type PortfolioRow,
  type PortfolioSpec,
} from "@/types/backtest"
import type { CashflowFrequency, RebalanceMode } from "@/engine"
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
    portfolios: [emptyPortfolio()],
    startYear: lastClosedYear - DEFAULT_YEARS_BACK,
    endYear: lastClosedYear,
    amount: DEFAULT_AMOUNT,
    benchmark: DEFAULT_BENCHMARK,
    baseCurrency: DEFAULT_BASE_CURRENCY,
    inflationAdjusted: DEFAULT_INFLATION_ADJUSTED,
  }
}

export function emptyRow(): PortfolioRow {
  return { symbol: "", weight: "" }
}

export function emptyPortfolio(): PortfolioSpec {
  return makePortfolio({ assets: [emptyRow(), emptyRow()] })
}

/** สร้างพอร์ตพร้อมค่าปริยายครบ — ค่าปริยายคือชุดที่ทำให้ผลเท่ากับก่อนมีเฟส 2 */
export function makePortfolio(spec: Partial<PortfolioSpec> = {}): PortfolioSpec {
  return {
    name: "",
    assets: [emptyRow()],
    rebalance: DEFAULT_REBALANCE,
    bandPoints: DEFAULT_BAND_POINTS,
    cashflow: null,
    ...spec,
  }
}

/** คีย์ของพอร์ตในลิงก์ — `p1` `p2` `p3` และค่าเสริมที่ `p1.n` `p1.rb` `p1.cf` (BR-CMP-20) */
const slotKeys = (slot: number) => ({
  assets: `p${slot}`,
  name: `p${slot}.n`,
  rebalance: `p${slot}.rb`,
  cashflow: `p${slot}.cf`,
})

const FREQUENCY_CODE: Record<CashflowFrequency, string> = {
  monthly: "m",
  quarterly: "q",
  annual: "y",
}
const FREQUENCY_BY_CODE = new Map(
  Object.entries(FREQUENCY_CODE).map(([key, code]) => [code, key as CashflowFrequency]),
)

/** `200:m:in:fixed:prorata:flat` — จำนวน:ความถี่:ทิศทาง:แบบ:วิธีกระจาย:ปรับตามเงินเฟ้อ */
function encodeCashflow(cashflow: CashflowSpec): string {
  return [
    cashflow.amount.trim(),
    FREQUENCY_CODE[cashflow.frequency],
    cashflow.direction === "deposit" ? "in" : "out",
    cashflow.basis === "fixed" ? "fixed" : "pct",
    cashflow.allocation,
    cashflow.inflationAdjusted ? "cpi" : "flat",
  ].join(":")
}

function parseCashflow(raw: string | null): CashflowSpec | null | "broken" {
  if (raw === null) return null
  const parts = raw.split(":")
  if (parts.length !== 6) return "broken"

  const [amount, frequency, direction, basis, allocation, inflation] = parts.map((p) => p.trim())
  const resolved = FREQUENCY_BY_CODE.get(frequency)
  if (
    resolved === undefined ||
    !["in", "out"].includes(direction) ||
    !["fixed", "pct"].includes(basis) ||
    !["prorata", "target"].includes(allocation) ||
    !["cpi", "flat"].includes(inflation)
  ) {
    return "broken"
  }

  return {
    amount,
    frequency: resolved,
    direction: direction === "in" ? "deposit" : "withdraw",
    basis: basis === "fixed" ? "fixed" : "percent",
    allocation: allocation as CashflowSpec["allocation"],
    inflationAdjusted: inflation === "cpi",
  }
}

/** `annual` หรือ `bands:5` — ไม่ระบุถือว่ารายปี ผลของลิงก์เดิมจึงไม่เปลี่ยน (BR-CMP-54) */
function parseRebalance(
  raw: string | null,
): { rebalance: RebalanceMode; bandPoints: string } | "broken" {
  if (raw === null) return { rebalance: DEFAULT_REBALANCE, bandPoints: DEFAULT_BAND_POINTS }

  const [mode, band] = raw.trim().split(":")
  if (!REBALANCE_OPTIONS.includes(mode as RebalanceMode)) return "broken"
  if (mode !== "bands") return { rebalance: mode as RebalanceMode, bandPoints: DEFAULT_BAND_POINTS }
  if (band === undefined || band === "") return "broken"
  return { rebalance: "bands", bandPoints: band }
}

/** ลิงก์ไม่มีค่าใดเลยหรือไม่ — กรณีนี้ถือเป็นฟอร์มเปล่าปกติ ไม่ใช่ข้อผิดพลาด (EC-URL-01) */
export function isEmptyParams(params: UrlParams): boolean {
  const keys = ["assets", "start", "end", "amount", "benchmark", "base", "real"]
  for (let slot = 1; slot <= MAX_PORTFOLIOS; slot++) {
    keys.push(...Object.values(slotKeys(slot)))
  }
  return keys.every((k) => params.get(k) === null)
}

export function decodeConfig(params: UrlParams, lastClosedYear: number): DecodeResult {
  const fallback = defaultConfig(lastClosedYear)
  const parsed = parsePortfolios(params)

  const startYear = parseYear(params.get("start"))
  const endYear = parseYear(params.get("end"))
  const amount = parseAmount(params.get("amount"))
  const benchmark = params.get("benchmark")?.trim().toUpperCase() || null
  const rawBase = params.get("base")
  const base = parseCurrency(rawBase)
  const rawReal = params.get("real")
  const real = parseFlag(rawReal)

  const config: BacktestConfig = {
    portfolios: parsed.portfolios.length > 0 ? parsed.portfolios : fallback.portfolios,
    startYear: startYear ?? fallback.startYear,
    endYear: endYear ?? fallback.endYear,
    amount: amount ?? fallback.amount,
    benchmark: benchmark ?? fallback.benchmark,
    // ลิงก์ที่ไม่ระบุสกุลเงินคือลิงก์ที่แชร์ไปก่อนมีตัวเลือกนี้ จึงต้องเป็นดอลลาร์เหมือนเดิม (BR-CUR-03)
    baseCurrency: base ?? LEGACY_LINK_CURRENCY,
    // ไม่ระบุ = ไม่ปรับเงินเฟ้อ ทั้งกับลิงก์เก่าและลิงก์ใหม่ (BR-INF-02, AC-INF-08)
    inflationAdjusted: real ?? DEFAULT_INFLATION_ADJUSTED,
  }

  const structurallyBroken =
    parsed.broken ||
    (params.get("start") !== null && startYear === null) ||
    (params.get("end") !== null && endYear === null) ||
    (params.get("amount") !== null && amount === null) ||
    // สกุลเงินที่ไม่รู้จักถือว่าอ่านโครงสร้างไม่ออก (EC-CUR-01)
    (rawBase !== null && base === null) ||
    (rawReal !== null && real === null)

  return structurallyBroken ? { ok: false, partial: config } : { ok: true, config }
}

/**
 * เขียนค่าที่ตั้งไว้ลงลิงก์
 *
 * พอร์ตเดียวที่ไม่ได้ตั้งชื่อเองยังใช้รูปแบบ `assets=` เดิมทุกตัวอักษร เพื่อให้ลิงก์ที่แชร์ไปแล้ว
 * และการใช้งานปกติไม่ขยับเลย (BR-CMP-31) · ใช้ `p1..p3` เฉพาะตอนเทียบหลายพอร์ตหรือมีชื่อที่ตั้งเอง
 */
export function encodeConfig(config: BacktestConfig): string {
  const query = new URLSearchParams()
  // ค่าเสริมของพอร์ตที่ไม่ใช่ค่าปริยาย บังคับให้ใช้รูปแบบหลายพอร์ต เพราะ `assets` เก็บได้แค่สินทรัพย์
  const customised = config.portfolios.some(
    (p) => p.name.trim() !== "" || p.rebalance !== DEFAULT_REBALANCE || p.cashflow !== null,
  )

  if (config.portfolios.length === 1 && !customised) {
    query.set("assets", encodeAssets(config.portfolios[0].assets))
  } else {
    config.portfolios.forEach((portfolio, index) => {
      const keys = slotKeys(index + 1)
      query.set(keys.assets, encodeAssets(portfolio.assets))
      if (portfolio.name.trim() !== "") query.set(keys.name, portfolio.name.trim())
      if (portfolio.rebalance !== DEFAULT_REBALANCE) {
        query.set(
          keys.rebalance,
          portfolio.rebalance === "bands"
            ? `bands:${portfolio.bandPoints.trim()}`
            : portfolio.rebalance,
        )
      }
      if (portfolio.cashflow) query.set(keys.cashflow, encodeCashflow(portfolio.cashflow))
    })
  }

  query.set("start", String(config.startYear))
  query.set("end", String(config.endYear))
  query.set("amount", String(config.amount))
  query.set("benchmark", config.benchmark.trim().toUpperCase())
  query.set("base", config.baseCurrency)
  // ใส่เฉพาะตอนเปิด — ลิงก์ที่ไม่ปรับเงินเฟ้อจึงหน้าตาเหมือนเดิมทุกตัวอักษร (BR-INF-02)
  if (config.inflationAdjusted) query.set("real", "1")

  // URLSearchParams เข้ารหัส , และ : ซึ่งอ่านยากในแถบที่อยู่ — คืนกลับให้อ่านออก
  return query.toString().replace(/%2C/g, ",").replace(/%3A/g, ":")
}

function encodeAssets(assets: PortfolioRow[]): string {
  return assets
    .filter((row) => row.symbol.trim() !== "")
    .map((row) => `${row.symbol.trim().toUpperCase()}:${row.weight.trim()}`)
    .join(",")
}

type ParsedPortfolios = { portfolios: PortfolioSpec[]; broken: boolean }

/**
 * อ่านพอร์ตทั้งหมดจากลิงก์ — รองรับทั้งรูปแบบเดิม (`assets`) และรูปแบบหลายพอร์ต (`p1..p3`)
 *
 * มีทั้งสองรูปแบบพร้อมกันถือว่าอ่านโครงสร้างไม่ออก เพราะตีความได้สองแบบและเดาแทนผู้ใช้ไม่ได้
 * ส่วนช่องที่ข้ามลำดับ (มี `p2` แต่ไม่มี `p1`) ยังตีความได้แบบเดียว จึงอ่านเป็นพอร์ตแรก (EC-CMP-03)
 */
type Source = { raw: string; name: string | null; rebalance: string | null; cashflow: string | null }

function parsePortfolios(params: UrlParams): ParsedPortfolios {
  const rawAssets = params.get("assets")
  const slots: Source[] = []
  for (let slot = 1; slot <= MAX_PORTFOLIOS; slot++) {
    const keys = slotKeys(slot)
    const raw = params.get(keys.assets)
    if (raw === null) continue
    slots.push({
      raw,
      name: params.get(keys.name),
      rebalance: params.get(keys.rebalance),
      cashflow: params.get(keys.cashflow),
    })
  }

  const overflow = params.get(slotKeys(MAX_PORTFOLIOS + 1).assets) !== null
  const mixed = rawAssets !== null && slots.length > 0
  const sources: Source[] =
    slots.length > 0
      ? slots
      : rawAssets !== null
        ? [{ raw: rawAssets, name: null, rebalance: null, cashflow: null }]
        : []

  let broken = mixed || overflow
  const portfolios: PortfolioSpec[] = []

  for (const source of sources) {
    const parsed = parseAssets(source.raw)
    if (parsed.broken || parsed.rows.length === 0 || parsed.rows.length > MAX_ASSETS) broken = true
    if (parsed.rows.length === 0) continue

    const rebalance = parseRebalance(source.rebalance)
    const cashflow = parseCashflow(source.cashflow)
    if (rebalance === "broken" || cashflow === "broken") broken = true

    portfolios.push(
      makePortfolio({
        name: (source.name ?? "").trim().slice(0, MAX_PORTFOLIO_NAME),
        assets: parsed.rows,
        ...(rebalance === "broken" ? {} : rebalance),
        cashflow: cashflow === "broken" ? null : cashflow,
      }),
    )
  }

  return { portfolios, broken }
}

function parseCurrency(raw: string | null): Currency | null {
  if (raw === null) return null
  const value = raw.trim().toUpperCase()
  return CURRENCY_OPTIONS.includes(value as Currency) ? (value as Currency) : null
}

/** ตัวเลือกเปิด/ปิดในลิงก์ — รับแค่ 1 กับ 0 ค่าอื่นถือว่าอ่านโครงสร้างไม่ออก */
function parseFlag(raw: string | null): boolean | null {
  if (raw === null) return null
  const value = raw.trim()
  if (value === "1") return true
  if (value === "0") return false
  return null
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
