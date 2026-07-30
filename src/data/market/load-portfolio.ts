import { convertReturns, currencyOf, needsFx, FX_SYMBOL, type Currency } from "@/data/currency"
import type { MonthRange, MonthlyReturn, PriceProvider } from "@/types/series"

/**
 * ดึงข้อมูลของทั้งพอร์ตแล้วทำให้เป็นสกุลเงินเดียวกัน ก่อนส่งต่อให้ชั้นคำนวณ (US-12)
 *
 * งานจัดลำดับการดึงข้อมูลอยู่ที่นี่ ไม่ใช่ในหน้าจอ เพราะกฎ "ห้ามเรียกอัตราแลกเปลี่ยนเมื่อไม่จำเป็น"
 * (BR-FX-06) พิสูจน์ได้ก็ต่อเมื่อทดสอบได้ด้วยการนับจำนวนครั้งที่เรียก
 */

export type LoadedAsset = {
  symbol: string
  returns: MonthlyReturn[]
}

export type LoadPortfolioInput = {
  provider: PriceProvider
  /** สัญลักษณ์ของสินทรัพย์ในพอร์ต เรียงตามลำดับที่ผู้ใช้กรอก */
  symbols: string[]
  benchmark: string
  range: MonthRange
  base: Currency
}

export type LoadPortfolioResult =
  | {
      ok: true
      assets: LoadedAsset[]
      benchmark: MonthlyReturn[]
      /** true เมื่อมีสินทรัพย์อย่างน้อยหนึ่งตัวถูกแปลงค่าเงิน — หน้าจอใช้แจ้งผู้ใช้ (BR-THB-07) */
      converted: boolean
    }
  | { ok: false; reason: "symbol-not-found"; symbols: string[] }
  | { ok: false; reason: "unreachable"; symbols: string[] }
  /** ดึงอัตราแลกเปลี่ยนไม่สำเร็จ — ห้ามแสดงผลที่ยังไม่แปลงค่า (BR-FX-08) */
  | { ok: false; reason: "fx-unreachable" }

export async function loadPortfolioSeries(
  input: LoadPortfolioInput,
): Promise<LoadPortfolioResult> {
  const { provider, symbols, benchmark, range, base } = input
  const wanted = [...symbols, benchmark]

  const results = await Promise.all(
    wanted.map((symbol) => provider.getMonthlySeries(symbol, range)),
  )

  const missing: string[] = []
  const unreachable: string[] = []
  results.forEach((result, i) => {
    if (result.ok) return
    if (result.failure.kind === "symbol-not-found") missing.push(wanted[i])
    else unreachable.push(wanted[i])
  })

  // ติดต่อไม่ได้มาก่อน เพราะเป็นปัญหาที่ลองใหม่แล้วอาจหาย ต่างจากสัญลักษณ์ที่ไม่มีอยู่จริง
  if (unreachable.length > 0) return { ok: false, reason: "unreachable", symbols: unreachable }
  if (missing.length > 0) return { ok: false, reason: "symbol-not-found", symbols: missing }

  const series = results.map((result) => (result.ok ? result.series.returns : []))

  // พอร์ตที่ทุกตัวเป็นสกุลเดียวกับฐานอยู่แล้ว ต้องไม่เรียกอัตราแลกเปลี่ยนเลย (BR-FX-06)
  let fx: MonthlyReturn[] = []
  const converting = needsFx(wanted, base)
  if (converting) {
    const fxResult = await provider.getMonthlySeries(FX_SYMBOL, range)
    if (!fxResult.ok) return { ok: false, reason: "fx-unreachable" }
    fx = fxResult.series.returns
  }

  const inBase = (symbol: string, returns: MonthlyReturn[]) =>
    convertReturns(returns, fx, currencyOf(symbol), base)

  return {
    ok: true,
    assets: symbols.map((symbol, i) => ({ symbol, returns: inBase(symbol, series[i]) })),
    benchmark: inBase(benchmark, series[series.length - 1]),
    converted: converting,
  }
}
