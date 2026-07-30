/**
 * รายการสัญลักษณ์ที่แนะนำในช่องค้นหา (BR-CFG-05, BR-SET-01, BR-CAT-01) —
 * มากับตัวเว็บ ไม่ต้องเรียกข้อมูลภายนอก · ผู้ใช้พิมพ์สัญลักษณ์นอกรายการเองได้เสมอ (BR-SET-07)
 *
 * **ทุกสัญลักษณ์ในไฟล์นี้ถูกยิงถามแหล่งข้อมูลจริงมาแล้วว่ามีข้อมูล** (BR-CAT-02) —
 * ห้ามเพิ่มจากความจำ เพราะตั๋วตายหรือเปลี่ยนชื่อได้ (เจอมาแล้ว: MAKRO ควบรวมเป็น CPAXT,
 * ESSO ถูกบางจากซื้อ) · ตรวจซ้ำได้ด้วย `node scripts/probe-symbols.mjs`
 */

export type SuggestedSymbol = {
  symbol: string
  /** คำอธิบายสั้น ๆ ใช้เป็นคีย์ i18n */
  labelKey: string
  /**
   * ปีแรกที่แหล่งข้อมูลมีข้อมูลจริง ([PD-017](../../../docs/product/decision-log.md))
   *
   * เป็น**ภาพนิ่ง ณ วันที่ยิงถาม** ไม่ได้ถามตอนผู้ใช้เปิดรายการ เพราะนั่นจะกลายเป็น
   * การเรียกเน็ตในช่องกรอก (BR-CAT-09) — ความสดของค่านี้เป็นหน้าที่ของสคริปต์ตรวจการเคลื่อน
   */
  since: number
}

/** หมวดย่อยหนึ่งหมวด — หัวข้อของมันคือสิ่งที่ขึ้นในกล่องที่กางลงมา (BR-CAT-15) */
export type SymbolGroup = {
  labelKey: string
  symbols: SuggestedSymbol[]
}

/** ฝั่งไทยกับฝั่งต่างประเทศ — แยกไว้เพราะ 19 หมวดเรียงแบนกันจะดูไม่ออกว่าอันไหนตลาดไหน */
export type SymbolSection = {
  labelKey: string
  groups: SymbolGroup[]
}

/**
 * ปีที่ถือว่า "ข้อมูลเต็ม" — ตัวที่เริ่มก่อนหน้านี้ไม่ต้องกำกับปี (BR-CAT-04)
 * มาจากช่วงที่ชุดข้อมูลอ้างอิงของโปรเจกต์เริ่มต้น
 */
export const FULL_HISTORY_SINCE = 2012

const s = (symbol: string, labelKey: string, since: number): SuggestedSymbol => ({
  symbol,
  labelKey,
  since,
})

export const SYMBOL_SECTIONS: SymbolSection[] = [
  {
    labelKey: "symbolGroups.thai",
    groups: [
      {
        labelKey: "symbolGroups.thaiBank",
        symbols: [
          s("KBANK.BK", "symbols.kbank", 2011),
          s("BBL.BK", "symbols.bbl", 2011),
          s("KTB.BK", "symbols.ktb", 2011),
          s("SCB.BK", "symbols.scb", 2022),
          s("TISCO.BK", "symbols.tisco", 2011),
          s("KKP.BK", "symbols.kkp", 2011),
          s("SAWAD.BK", "symbols.sawad", 2014),
          s("MTC.BK", "symbols.mtc", 2014),
        ],
      },
      {
        labelKey: "symbolGroups.thaiEnergy",
        symbols: [
          s("PTT.BK", "symbols.ptt", 2011),
          s("PTTEP.BK", "symbols.pttep", 2011),
          s("TOP.BK", "symbols.top", 2011),
          s("IRPC.BK", "symbols.irpc", 2011),
          s("PTTGC.BK", "symbols.pttgc", 2011),
          s("GPSC.BK", "symbols.gpsc", 2015),
          s("GULF.BK", "symbols.gulf", 2025),
          s("EA.BK", "symbols.ea", 2012),
        ],
      },
      {
        labelKey: "symbolGroups.thaiRetail",
        symbols: [
          s("CPALL.BK", "symbols.cpall", 2011),
          s("CPF.BK", "symbols.cpf", 2011),
          s("TU.BK", "symbols.tu", 2011),
          s("BJC.BK", "symbols.bjc", 2011),
          s("HMPRO.BK", "symbols.hmpro", 2011),
          s("GLOBAL.BK", "symbols.global", 2011),
          s("CRC.BK", "symbols.crc", 2020),
          s("OSP.BK", "symbols.osp", 2018),
        ],
      },
      {
        labelKey: "symbolGroups.thaiTelecom",
        symbols: [
          s("ADVANC.BK", "symbols.advanc", 2011),
          s("TRUE.BK", "symbols.true", 2011),
          s("DELTA.BK", "symbols.delta", 2011),
          s("KCE.BK", "symbols.kce", 2011),
          s("HANA.BK", "symbols.hana", 2011),
          s("COM7.BK", "symbols.com7", 2015),
        ],
      },
      {
        labelKey: "symbolGroups.thaiProperty",
        symbols: [
          s("SCC.BK", "symbols.scc", 2011),
          s("CPN.BK", "symbols.cpn", 2011),
          s("LH.BK", "symbols.lh", 2011),
          s("SPALI.BK", "symbols.spali", 2011),
          s("AWC.BK", "symbols.awc", 2019),
        ],
      },
      {
        labelKey: "symbolGroups.thaiTransport",
        symbols: [
          s("AOT.BK", "symbols.aot", 2011),
          s("BEM.BK", "symbols.bem", 2011),
          s("AAV.BK", "symbols.aav", 2012),
          s("BA.BK", "symbols.ba", 2014),
        ],
      },
      {
        labelKey: "symbolGroups.thaiTourism",
        symbols: [
          s("MINT.BK", "symbols.mint", 2011),
          s("CENTEL.BK", "symbols.centel", 2011),
          s("ERW.BK", "symbols.erw", 2011),
        ],
      },
      {
        labelKey: "symbolGroups.thaiHealth",
        symbols: [s("BDMS.BK", "symbols.bdms", 2011), s("BH.BK", "symbols.bh", 2011)],
      },
      {
        labelKey: "symbolGroups.thaiIndustry",
        symbols: [
          s("IVL.BK", "symbols.ivl", 2011),
          s("STA.BK", "symbols.sta", 2011),
          s("SPRC.BK", "symbols.sprc", 2015),
          s("TCAP.BK", "symbols.tcap", 2011),
          s("SCGP.BK", "symbols.scgp", 2020),
        ],
      },
      {
        labelKey: "symbolGroups.thaiEtf",
        symbols: [s("TDEX.BK", "symbols.tdex", 2011)],
      },
    ],
  },
  {
    labelKey: "symbolGroups.global",
    groups: [
      {
        labelKey: "symbolGroups.usTotal",
        symbols: [
          s("VTI", "symbols.vti", 2011),
          s("VOO", "symbols.voo", 2011),
          s("IVV", "symbols.ivv", 2011),
          s("SPY", "symbols.spy", 2011),
          s("QQQ", "symbols.qqq", 2011),
          s("IWM", "symbols.iwm", 2011),
          s("IJR", "symbols.ijr", 2011),
        ],
      },
      {
        labelKey: "symbolGroups.world",
        symbols: [
          s("VT", "symbols.vt", 2011),
          s("VXUS", "symbols.vxus", 2011),
          s("VEA", "symbols.vea", 2011),
          s("EFA", "symbols.efa", 2011),
          s("VWO", "symbols.vwo", 2011),
          s("EEM", "symbols.eem", 2011),
          s("IEMG", "symbols.iemg", 2012),
        ],
      },
      {
        labelKey: "symbolGroups.style",
        symbols: [
          s("VUG", "symbols.vug", 2011),
          s("VTV", "symbols.vtv", 2011),
          s("SCHD", "symbols.schd", 2011),
          s("VIG", "symbols.vig", 2011),
          s("VYM", "symbols.vym", 2011),
        ],
      },
      {
        labelKey: "symbolGroups.bonds",
        symbols: [
          s("BND", "symbols.bnd", 2011),
          s("AGG", "symbols.agg", 2011),
          s("TLT", "symbols.tlt", 2011),
          s("IEF", "symbols.ief", 2011),
          s("LQD", "symbols.lqd", 2011),
          s("HYG", "symbols.hyg", 2011),
          s("TIP", "symbols.tip", 2011),
          s("BNDX", "symbols.bndx", 2013),
        ],
      },
      {
        labelKey: "symbolGroups.sectors",
        symbols: [
          s("VGT", "symbols.vgt", 2011),
          s("XLE", "symbols.xle", 2011),
          s("XLF", "symbols.xlf", 2011),
          s("XLV", "symbols.xlv", 2011),
          s("SOXX", "symbols.soxx", 2011),
        ],
      },
      {
        labelKey: "symbolGroups.realAsset",
        symbols: [
          s("VNQ", "symbols.vnq", 2011),
          s("GLD", "symbols.gld", 2011),
          s("SLV", "symbols.slv", 2011),
          s("DBC", "symbols.dbc", 2011),
        ],
      },
      {
        labelKey: "symbolGroups.usStocks",
        symbols: [
          s("AAPL", "symbols.aapl", 2011),
          s("MSFT", "symbols.msft", 2011),
          s("NVDA", "symbols.nvda", 2011),
          s("GOOGL", "symbols.googl", 2011),
          s("AMZN", "symbols.amzn", 2011),
          s("META", "symbols.meta", 2012),
          s("TSLA", "symbols.tsla", 2011),
          s("BRK-B", "symbols.brkb", 2011),
          s("JPM", "symbols.jpm", 2011),
          s("V", "symbols.v", 2011),
        ],
      },
      {
        labelKey: "symbolGroups.crypto",
        symbols: [
          s("BTC-USD", "symbols.btc", 2014),
          s("ETH-USD", "symbols.eth", 2017),
          s("IBIT", "symbols.ibit", 2024),
        ],
      },
      {
        labelKey: "symbolGroups.highGrowth",
        symbols: [s("ARKK", "symbols.arkk", 2014)],
      },
    ],
  },
]

/** ทุกหมวดเรียงต่อกัน — รูปที่กล่องเลือกแบบแบ่งหมวดใช้ */
export const SYMBOL_GROUPS: SymbolGroup[] = SYMBOL_SECTIONS.flatMap((section) => section.groups)

/** รายการแบนของทุกสัญลักษณ์ — รูปที่โค้ดเดิมใช้อยู่ ไม่เปลี่ยนสัญญา */
export const SUGGESTED_SYMBOLS: SuggestedSymbol[] = SYMBOL_GROUPS.flatMap((g) => g.symbols)

/** ค้นหนึ่งสัญลักษณ์ — ใช้ตอนประกอบคำอธิบายใต้ตัวเลือก */
export function findSymbol(symbol: string): SuggestedSymbol | undefined {
  return SUGGESTED_SYMBOLS.find((item) => item.symbol === symbol)
}

/** หมวดที่สัญลักษณ์นั้นอยู่ */
export function groupOf(symbol: string): SymbolGroup | undefined {
  return SYMBOL_GROUPS.find((g) => g.symbols.some((item) => item.symbol === symbol))
}
