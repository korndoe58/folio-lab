import { describe, expect, test } from "vitest"
import bnd from "@/data/fixtures/bnd.json"
import cpi from "@/data/fixtures/th-cpi.json"
import rf from "@/data/fixtures/rf.json"
import spy from "@/data/fixtures/spy.json"
import uponly from "@/data/fixtures/uponly.json"
import vnq from "@/data/fixtures/vnq.json"
import vti from "@/data/fixtures/vti.json"
import vxus from "@/data/fixtures/vxus.json"
import { endBalance, portfolioReturns } from "@/engine"
import type { MonthlyReturn } from "@/types/series"
import { formatMoney, formatPercent, formatRatio, NO_VALUE } from "./format"
import { assembleSummary, type PortfolioOutcome, type SummaryRow } from "./summary"

const REFERENCE = portfolioReturns([
  { symbol: "VTI", weight: 48, returns: vti.returns },
  { symbol: "VNQ", weight: 8, returns: vnq.returns },
  { symbol: "VXUS", weight: 24, returns: vxus.returns },
  { symbol: "BND", weight: 20, returns: bnd.returns },
]).returns

const BENCHMARK = portfolioReturns([{ symbol: "SPY", weight: 100, returns: spy.returns }]).returns

/** ผลของพอร์ตที่ไม่มีเงินเข้าออกและใช้ค่าปริยาย — รูปแบบที่ทุกเทสต์เดิมสมมติไว้ */
const plain = (returns: MonthlyReturn[], amount = 10_000): PortfolioOutcome => ({
  returns,
  endValue: endBalance(returns, amount),
  contributed: 0,
  withdrawn: 0,
  hasCashflow: false,
  moneyWeighted: null,
  rebalanceCount: 0,
  customRebalance: false,
})

const summary = assembleSummary({
  outcomes: [plain(REFERENCE)],
  benchmark: BENCHMARK,
  riskFree: rf.returns as MonthlyReturn[],
  amount: 10_000,
})

const find = (metric: string): SummaryRow => {
  const row = summary.rows.find((r) => r.metric === metric)
  if (!row) throw new Error(`ไม่พบแถว ${metric}`)
  return row
}

/** ค่าของพอร์ตลำดับนั้น หรือของตัวเทียบ */
const valueOf = (row: SummaryRow, column: "portfolio" | "benchmark", index = 0) =>
  column === "benchmark" ? row.benchmark : row.portfolios[index].value

const shown = (row: SummaryRow, column: "portfolio" | "benchmark") => {
  const value = valueOf(row, column)
  if (row.format === "money") return formatMoney(value, "USD")
  if (row.format === "percent") return formatPercent(value)
  return formatRatio(value)
}

/**
 * แถวที่ตัวเทียบ **ไม่มีค่าโดยนิยาม** ไม่ใช่เพราะคำนวณพลาด
 *
 * ตัวเทียบเทียบกับตัวเองมีส่วนต่างเป็นศูนย์สนิท → ตัวหารของผลตอบแทนต่อส่วนต่างเป็นศูนย์
 * → ต้องคืนไม่มีค่า ไม่ใช่อนันต์ (BR-RSK-14, BR-RSK-03)
 */
const NO_BENCHMARK_VALUE = new Set(["informationRatio"])

describe("US-07 ค่าที่จะขึ้นบนตารางสรุป", () => {
  /**
   * เก้าแถวของเฟส 0–1 ต้องอยู่ครบและเรียงเหมือนเดิม **ที่ต้นตาราง** เสมอ
   *
   * ไม่ผูกกับจำนวนแถวทั้งหมด เพราะเฟส 4 เพิ่มแถวเข้ามาโดยตั้งใจตาม BR-RSK-05 —
   * สิ่งที่การ์ด US-07 สัญญาไว้คือ "เก้าค่านี้มีอยู่และเรียงแบบนี้" ไม่ใช่ "ตารางจะไม่โตอีก"
   * (บทเรียน ep#34: เทสต์ต้องยืนยันกฎที่การ์ดเขียน ไม่ใช่สภาพที่บังเอิญเป็นอยู่)
   */
  test("BR-SUM-02 เก้าแถวเดิมอยู่ครบและเรียงตามลำดับที่การ์ดกำหนด", () => {
    expect(summary.rows.slice(0, 9).map((r) => r.metric)).toEqual([
      "startAmount",
      "endBalance",
      "cagr",
      "stdev",
      "bestYear",
      "worstYear",
      "maxDrawdown",
      "sharpe",
      "sortino",
    ])
  })

  test("AC-SUM-01 ค่าของพอร์ตตรงกับที่ชุดทดสอบของชั้นคำนวณยืนยันไว้", () => {
    expect(shown(find("endBalance"), "portfolio")).toBe("$41,495")
    expect(shown(find("cagr"), "portfolio")).toBe("10.31%")
    expect(shown(find("stdev"), "portfolio")).toBe("11.42%")
    expect(shown(find("maxDrawdown"), "portfolio")).toBe("-23.55%")
    expect(shown(find("sharpe"), "portfolio")).toBe("0.78")
    expect(shown(find("sortino"), "portfolio")).toBe("1.19")
  })

  test("AC-SUM-02 คอลัมน์ตัวเทียบมีค่าครบทุกแถว", () => {
    expect(shown(find("endBalance"), "benchmark")).toBe("$76,589")
    expect(shown(find("cagr"), "benchmark")).toBe("15.07%")
    expect(shown(find("stdev"), "benchmark")).toBe("14.04%")
    expect(shown(find("maxDrawdown"), "benchmark")).toBe("-23.93%")
    expect(shown(find("sharpe"), "benchmark")).toBe("0.96")
    expect(shown(find("sortino"), "benchmark")).toBe("1.55")

    for (const row of summary.rows) {
      if (NO_BENCHMARK_VALUE.has(row.metric)) continue
      expect(row.benchmark, `แถว ${row.metric} ต้องมีค่าของตัวเทียบ`).not.toBeNull()
    }
  })

  test("AC-SUM-04 ปีที่ดีที่สุดและแย่ที่สุดพร้อมปีกำกับ (เฉพาะปีเต็ม)", () => {
    const best = find("bestYear")
    expect(best.portfolios[0].year).toBe(2019)
    expect(shown(best, "portfolio")).toBe("24.02%")

    const worst = find("worstYear")
    expect(worst.portfolios[0].year).toBe(2022)
    expect(shown(worst, "portfolio")).toBe("-17.95%")
  })

  test("BR-SUM-07 ทิศเทียบตัวเทียบถูกต้องต่อแถว", () => {
    // พอร์ตให้ผลตอบแทนน้อยกว่าตลาดในช่วงนี้
    expect(find("cagr").portfolios[0].comparison).toBe("worse")
    // แต่ผันผวนน้อยกว่าและขาดทุนตื้นกว่า จึงถือว่าดีกว่าในสองแถวนั้น
    expect(find("stdev").portfolios[0].comparison).toBe("better")
    expect(find("maxDrawdown").portfolios[0].comparison).toBe("better")
    // เงินตั้งต้นเท่ากันไม่ต้องเทียบ
    expect(find("startAmount").portfolios[0].comparison).toBeNull()
  })

  test("จำนวนเดือนตรงกับช่วงที่ใช้จริง", () => {
    expect(summary.months).toBe(174)
  })
})

describe("US-07 ค่าที่คำนวณไม่ได้", () => {
  const upOnly = portfolioReturns([{ symbol: "UPONLY", weight: 100, returns: uponly.returns }]).returns
  const noDownside = assembleSummary({
    outcomes: [plain(upOnly)],
    benchmark: BENCHMARK,
    riskFree: rf.returns as MonthlyReturn[],
    amount: 10_000,
  })

  test("AC-SUM-05 พอร์ตที่ไม่มีเดือนติดลบ Sortino ไม่มีค่าและมีเหตุผลกำกับ", () => {
    const row = noDownside.rows.find((r) => r.metric === "sortino")!

    expect(row.portfolios[0].value).toBeNull()
    expect(row.portfolios[0].unavailableReason).toBe("summary.noDownside")
    expect(formatRatio(row.portfolios[0].value)).toBe(NO_VALUE)
    expect(row.portfolios[0].comparison, "เทียบไม่ได้เมื่อค่าหนึ่งไม่มี").toBeNull()
  })

  test("ค่าที่ไม่มีต้องไม่ถูกแสดงเป็นศูนย์", () => {
    expect(formatMoney(null, "USD")).toBe(NO_VALUE)
    expect(formatPercent(null)).toBe(NO_VALUE)
    expect(formatRatio(null)).toBe(NO_VALUE)
  })
})

describe("US-16 ตารางสรุปหลายพอร์ต", () => {
  const allStocks = portfolioReturns([{ symbol: "VTI", weight: 100, returns: vti.returns }]).returns
  const compared = assembleSummary({
    outcomes: [plain(REFERENCE), plain(allStocks)],
    benchmark: BENCHMARK,
    riskFree: rf.returns as MonthlyReturn[],
    amount: 10_000,
  })

  const comparedRow = (metric: string): SummaryRow =>
    compared.rows.find((r) => r.metric === metric)!

  test("AC-CMP-04 ทุกแถวมีค่าครบทุกพอร์ตและตัวเทียบ", () => {
    for (const row of compared.rows) {
      expect(row.portfolios, `แถว ${row.metric}`).toHaveLength(2)
      if (NO_BENCHMARK_VALUE.has(row.metric)) continue
      expect(row.benchmark, `แถว ${row.metric} ต้องมีค่าของตัวเทียบ`).not.toBeNull()
    }
  })

  test("BR-CMP-31 พอร์ตแรกได้ค่าเท่ากับตอนรันเดี่ยวทุกหลัก", () => {
    for (const row of compared.rows) {
      expect(row.portfolios[0], `แถว ${row.metric}`).toEqual(find(row.metric).portfolios[0])
    }
  })

  test("BR-CMP-23 เทียบทิศกับตัวเทียบ ไม่ใช่เทียบพอร์ตกันเอง", () => {
    // พอร์ตหุ้นล้วนให้ผลตอบแทนสูงกว่าพอร์ตผสม แต่ทั้งคู่ยังแพ้ตัวเทียบในช่วงนี้
    expect(comparedRow("cagr").portfolios[1].value!).toBeGreaterThan(
      comparedRow("cagr").portfolios[0].value!,
    )
    expect(comparedRow("cagr").portfolios[0].comparison).toBe("worse")
    expect(comparedRow("cagr").portfolios[1].comparison).toBe("worse")
  })

  test("ค่าที่คำนวณไม่ได้เป็นเรื่องของพอร์ตนั้น ไม่ลามไปพอร์ตอื่น", () => {
    const upOnly = portfolioReturns([
      { symbol: "UPONLY", weight: 100, returns: uponly.returns },
    ]).returns
    const mixed = assembleSummary({
      outcomes: [plain(REFERENCE), plain(upOnly)],
      benchmark: BENCHMARK,
      riskFree: rf.returns as MonthlyReturn[],
      amount: 10_000,
    })
    const sortinoRow = mixed.rows.find((r) => r.metric === "sortino")!

    expect(sortinoRow.portfolios[0].value).not.toBeNull()
    expect(sortinoRow.portfolios[0].unavailableReason).toBeUndefined()
    expect(sortinoRow.portfolios[1].value).toBeNull()
    expect(sortinoRow.portfolios[1].unavailableReason).toBe("summary.noDownside")
  })

  test("BR-CMP-26 ลำดับพอร์ตในทุกแถวตรงกับลำดับที่ส่งเข้าไป", () => {
    const reversed = assembleSummary({
      outcomes: [plain(allStocks), plain(REFERENCE)],
      benchmark: BENCHMARK,
      riskFree: rf.returns as MonthlyReturn[],
      amount: 10_000,
    })

    expect(reversed.rows.map((r) => r.portfolios[0].value)).toEqual(
      compared.rows.map((r) => r.portfolios[1].value),
    )
  })
})

describe("US-15 ปรับเงินเฟ้อในตารางสรุป", () => {
  const real = assembleSummary({
    outcomes: [plain(REFERENCE)],
    benchmark: BENCHMARK,
    riskFree: rf.returns as MonthlyReturn[],
    amount: 10_000,
    inflation: { rates: cpi.rates, enabled: true },
  })

  const realRow = (metric: string): SummaryRow => {
    const row = real.rows.find((r) => r.metric === metric)
    if (!row) throw new Error(`ไม่พบแถว ${metric}`)
    return row
  }

  test("BR-INF-04 ค่าที่ควรถูกปรับ ลดลงและถูกกำกับว่าหักเงินเฟ้อแล้ว", () => {
    for (const metric of ["endBalance", "cagr"]) {
      expect(realRow(metric).adjusted, `แถว ${metric} ต้องถูกกำกับ`).toBe(true)
      expect(realRow(metric).portfolios[0].value!).toBeLessThan(find(metric).portfolios[0].value!)
      expect(realRow(metric).benchmark!).toBeLessThan(find(metric).benchmark!)
    }
    expect(realRow("bestYear").adjusted).toBe(true)
    expect(realRow("worstYear").adjusted).toBe(true)
  })

  test("BR-INF-08 ค่าความเสี่ยงเท่าเดิมทุกหลัก และไม่ถูกกำกับ", () => {
    for (const metric of ["stdev", "maxDrawdown", "sharpe", "sortino"]) {
      expect(realRow(metric).portfolios[0].value, `แถว ${metric} ของพอร์ตต้องไม่ขยับ`).toBe(
        find(metric).portfolios[0].value,
      )
      expect(realRow(metric).benchmark, `แถว ${metric} ของตัวเทียบต้องไม่ขยับ`).toBe(
        find(metric).benchmark,
      )
      expect(realRow(metric).adjusted).toBeUndefined()
    }
    expect(realRow("startAmount").portfolios[0].value).toBe(10_000)
    expect(realRow("startAmount").adjusted).toBeUndefined()
  })

  test("AC-INF-03 มูลค่าสุดท้ายและผลตอบแทนต่อปีตรวจทานกับการคำนวณมือได้", () => {
    // ช่วงอ้างอิงคือ 2012 ถึง 2026 (174 เดือน) — ปี 2026 ยังไม่มีดัชนี ถือว่าเงินเฟ้อเป็นศูนย์
    const years = Array.from({ length: 15 }, (_, i) => 2012 + i)
    const factor = years.reduce((acc, year) => {
      const rate = cpi.rates.find((r) => r.year === year)
      return rate ? acc * (1 + rate.value) : acc
    }, 1)

    const nominalEnd = find("endBalance").portfolios[0].value!
    expect(realRow("endBalance").portfolios[0].value).toBeCloseTo(nominalEnd / factor, 9)
    expect(realRow("cagr").portfolios[0].value).toBeCloseTo(
      (nominalEnd / factor / 10_000) ** (12 / 174) - 1,
      12,
    )
  })

  test("AC-INF-06 ปีที่ยังไม่มีดัชนีถูกรายงานออกมา", () => {
    expect(cpi.rates.some((r) => r.year === 2026)).toBe(false)
    expect(real.inflationGapYears).toEqual([2026])
  })

  test("BR-INF-05 ปีแย่ที่สุดคือ 2022 ที่เงินเฟ้อพุ่ง และค่าตรงกับสูตรหาร", () => {
    const worst = realRow("worstYear")
    const rate2022 = cpi.rates.find((r) => r.year === 2022)!

    expect(worst.portfolios[0].year).toBe(2022)
    // ปี 2022 ติดลบอยู่แล้ว พอหักเงินเฟ้อ 6.08% ยิ่งติดลบมากขึ้น
    expect(worst.portfolios[0].value!).toBeLessThan(find("worstYear").portfolios[0].value!)
    expect(worst.portfolios[0].value).toBeCloseTo(
      (1 + find("worstYear").portfolios[0].value!) / (1 + rate2022.value) - 1,
      12,
    )
  })

  test("AC-INF-10 ปิดตัวเลือกแล้วได้ผลชุดเดิมทุกหลัก", () => {
    const off = assembleSummary({
      outcomes: [plain(REFERENCE)],
      benchmark: BENCHMARK,
      riskFree: rf.returns as MonthlyReturn[],
      amount: 10_000,
      inflation: { rates: cpi.rates, enabled: false },
    })

    expect(off).toEqual(summary)
    expect(off.inflationGapYears).toEqual([])
  })
})

describe("BR-MVP-04 รูปแบบตัวเลข", () => {
  test("จำนวนเงินเป็นจำนวนเต็ม คั่นหลักพัน พร้อมสัญลักษณ์ของสกุลเงินฐาน", () => {
    expect(formatMoney(41_515.37, "USD")).toBe("$41,515")
    expect(formatMoney(1_234_567, "USD")).toBe("$1,234,567")
    expect(formatMoney(0, "USD")).toBe("$0")
    expect(formatMoney(41_515.37, "THB"), "สกุลบาทใช้สัญลักษณ์ของตัวเอง").toBe("฿41,515")
  })

  test("เปอร์เซ็นต์สองตำแหน่ง รวมค่าติดลบ", () => {
    expect(formatPercent(0.1032)).toBe("10.32%")
    expect(formatPercent(-0.2355)).toBe("-23.55%")
    expect(formatPercent(0)).toBe("0.00%")
  })

  test("อัตราส่วนสองตำแหน่ง", () => {
    expect(formatRatio(0.78)).toBe("0.78")
    expect(formatRatio(-0.5)).toBe("-0.50")
  })
})

describe("US-30 + US-31 แถวเมทริกเชิงลึกของเฟส 4", () => {
  const find = (metric: string) => {
    const row = summary.rows.find((r) => r.metric === metric)
    if (!row) throw new Error(`ไม่พบแถว ${metric}`)
    return row
  }

  test("AC-RSK-01 สิบสามแถวใหม่อยู่ครบและแบ่งเป็นสองกลุ่ม", () => {
    const relative = summary.rows.filter((r) => r.group === "benchmarkRelative")
    const tail = summary.rows.filter((r) => r.group === "tailRisk")

    expect(relative.map((r) => r.metric)).toEqual([
      "beta",
      "alpha",
      "rSquared",
      "trackingError",
      "informationRatio",
      "upsideCapture",
      "downsideCapture",
    ])
    expect(tail.map((r) => r.metric)).toEqual([
      "varHistorical",
      "varAnalytical",
      "cvar",
      "skewness",
      "kurtosis",
      "calmar",
    ])
  })

  test("ค่าของพอร์ตอ้างอิงตรงกับที่ชั้นคำนวณยืนยันไว้", () => {
    expect(shown(find("beta"), "portfolio")).toBe("0.79")
    expect(shown(find("alpha"), "portfolio")).toBe("-1.36%")
    expect(shown(find("upsideCapture"), "portfolio")).toBe("72.18%")
    expect(shown(find("downsideCapture"), "portfolio")).toBe("85.25%")
    expect(shown(find("varHistorical"), "portfolio")).toBe("5.24%")
    expect(shown(find("cvar"), "portfolio")).toBe("7.04%")
  })

  /**
   * ★ BR-RSK-18 — คอลัมน์ตัวเทียบของกลุ่มแรกคือตัวเทียบเทียบกับตัวเอง
   * ค่าพวกนี้จึงต้องเป็นค่าคงที่ตามนิยาม ไม่ใช่ค่าที่คำนวณแล้วบังเอิญได้
   */
  test("BR-RSK-18 คอลัมน์ตัวเทียบของกลุ่มเทียบตลาดเป็นค่าตามนิยาม", () => {
    expect(find("beta").benchmark).toBe(1)
    expect(find("alpha").benchmark).toBe(0)
    expect(find("rSquared").benchmark).toBe(1)
    expect(find("trackingError").benchmark).toBe(0)
    expect(find("upsideCapture").benchmark).toBe(1)
    expect(find("downsideCapture").benchmark).toBe(1)
    // ส่วนต่างเป็นศูนย์สนิท → ตัวหารศูนย์ → ไม่มีค่า (BR-RSK-14)
    expect(find("informationRatio").benchmark).toBeNull()
  })

  /**
   * ค่าที่สูงหรือต่ำไม่ได้แปลว่า "ดีกว่า" ต้องไม่ติดป้ายเทียบ
   * มิฉะนั้นเครื่องมือจะตัดสินแทนผู้ใช้ในเรื่องที่ตัดสินไม่ได้ (ต่อจาก BR-CMP-23)
   */
  test("Beta · ความเบ้ · ความหนาของหาง ไม่ติดป้ายดีกว่าหรือแย่กว่า", () => {
    for (const metric of ["beta", "rSquared", "trackingError", "skewness", "kurtosis"]) {
      expect(find(metric).portfolios[0].comparison, `แถว ${metric}`).toBeNull()
    }
    // ส่วนค่าที่มีทิศจริงต้องยังติดป้ายอยู่
    expect(find("alpha").portfolios[0].comparison).not.toBeNull()
    expect(find("downsideCapture").portfolios[0].comparison).not.toBeNull()
  })

  test("VaR และ CVaR แสดงเป็นขนาดของการขาดทุน คือค่าบวก (BR-RSK-24)", () => {
    for (const metric of ["varHistorical", "varAnalytical", "cvar"]) {
      expect(find(metric).portfolios[0].value, `แถว ${metric}`).toBeGreaterThan(0)
    }
  })
})
