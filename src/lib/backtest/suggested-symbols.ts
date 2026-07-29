/**
 * รายการสัญลักษณ์ที่แนะนำในช่องค้นหา (BR-CFG-05) — มากับตัวเว็บ ไม่ต้องเรียกข้อมูลภายนอก
 * ผู้ใช้พิมพ์สัญลักษณ์นอกรายการเองได้เสมอ
 */
export type SuggestedSymbol = {
  symbol: string
  /** คำอธิบายสั้น ๆ ใช้เป็นคีย์ i18n */
  labelKey: string
}

export const SUGGESTED_SYMBOLS: SuggestedSymbol[] = [
  { symbol: "VTI", labelKey: "symbols.vti" },
  { symbol: "VXUS", labelKey: "symbols.vxus" },
  { symbol: "BND", labelKey: "symbols.bnd" },
  { symbol: "VNQ", labelKey: "symbols.vnq" },
  { symbol: "SPY", labelKey: "symbols.spy" },
]
