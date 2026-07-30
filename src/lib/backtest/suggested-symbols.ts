/**
 * รายการสัญลักษณ์ที่แนะนำในช่องค้นหา (BR-CFG-05, BR-SET-01) — มากับตัวเว็บ ไม่ต้องเรียกข้อมูลภายนอก
 * ผู้ใช้พิมพ์สัญลักษณ์นอกรายการเองได้เสมอ (BR-SET-07)
 */
export type SuggestedSymbol = {
  symbol: string
  /** คำอธิบายสั้น ๆ ใช้เป็นคีย์ i18n */
  labelKey: string
}

export type SymbolGroup = {
  /** หัวข้อกลุ่ม ใช้เป็นคีย์ i18n */
  labelKey: string
  symbols: SuggestedSymbol[]
}

export const SYMBOL_GROUPS: SymbolGroup[] = [
  {
    labelKey: "symbolGroups.global",
    symbols: [
      { symbol: "VTI", labelKey: "symbols.vti" },
      { symbol: "VXUS", labelKey: "symbols.vxus" },
      { symbol: "BND", labelKey: "symbols.bnd" },
      { symbol: "VNQ", labelKey: "symbols.vnq" },
      { symbol: "SPY", labelKey: "symbols.spy" },
    ],
  },
  {
    labelKey: "symbolGroups.thai",
    symbols: [
      { symbol: "PTT.BK", labelKey: "symbols.ptt" },
      { symbol: "CPALL.BK", labelKey: "symbols.cpall" },
      { symbol: "AOT.BK", labelKey: "symbols.aot" },
      { symbol: "ADVANC.BK", labelKey: "symbols.advanc" },
      { symbol: "KBANK.BK", labelKey: "symbols.kbank" },
    ],
  },
]

export const SUGGESTED_SYMBOLS: SuggestedSymbol[] = SYMBOL_GROUPS.flatMap((g) => g.symbols)
