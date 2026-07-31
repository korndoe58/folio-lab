import {
  alpha,
  analyticalVaR,
  annualReturns,
  annualizedStdev,
  beta,
  bestWorstFullYears,
  cagr,
  calmar,
  captureRatios,
  conditionalVaR,
  coveredYears,
  cumulativeInflation,
  endBalance,
  excessKurtosis,
  historicalVaR,
  informationRatio,
  maxDrawdown,
  rSquared,
  realAnnualReturns,
  realCagr,
  realEndBalance,
  sharpe,
  skewness,
  sortino,
  trackingError,
  type InflationRate,
} from "@/engine"
import type { MonthlyReturn } from "@/types/series"

/** ชนิดของค่าในตาราง ใช้เลือกวิธีจัดรูปแบบที่หน้าจอ */
export type MetricFormat = "money" | "percent" | "ratio" | "count"

/** ชื่อกลุ่มของแถว — หน้าจอใช้เป็นคีย์ i18n ของหัวกลุ่ม */
const RELATIVE_GROUP = "benchmarkRelative"
const TAIL_GROUP = "tailRisk"

/**
 * ทิศทางที่ถือว่า "ดีกว่า" — ความผันผวนและช่วงขาดทุนยิ่งใกล้ศูนย์ยิ่งดี
 * `none` = สูงหรือต่ำไม่ได้แปลว่าดีกว่า (Beta · ความเบ้ · ความหนาของหาง) เครื่องมือจึงไม่ตัดสินแทน
 */
type Direction = "higher-better" | "closer-to-zero-better" | "none"

/** ค่าของหนึ่งพอร์ตในหนึ่งแถว */
export type SummaryCell = {
  value: number | null
  /** ปีของค่านั้น สำหรับแถวปีที่ดีที่สุด/แย่ที่สุด */
  year?: number
  /**
   * พอร์ตนี้ดีกว่าหรือแย่กว่า **ตัวเทียบ** — null เมื่อเทียบไม่ได้
   * เทียบกับตัวเทียบเสมอ ไม่ใช่เทียบพอร์ตกันเอง เพราะพอร์ตไหน "ดีกว่า" ขึ้นกับว่าผู้ใช้
   * ให้น้ำหนักผลตอบแทนหรือความเสี่ยง ซึ่งเครื่องมือไม่ควรตัดสินแทน (BR-CMP-23)
   */
  comparison: "better" | "worse" | "equal" | null
  /** เหตุผลที่ค่านี้คำนวณไม่ได้ (คีย์ i18n) */
  unavailableReason?: string
}

export type SummaryRow = {
  /** คีย์ของคำอธิบายใน metric-glossary */
  metric: string
  format: MetricFormat
  /** หนึ่งช่องต่อพอร์ต เรียงตามลำดับพอร์ตในฟอร์ม (BR-CMP-22, BR-CMP-26) */
  portfolios: SummaryCell[]
  benchmark: number | null
  benchmarkYear?: number
  /** ค่านี้หักเงินเฟ้อแล้ว — หน้าจอต้องกำกับให้เห็น ไม่ใช่เปลี่ยนตัวเลขเงียบ ๆ (BR-INF-10) */
  adjusted?: boolean
  /**
   * กลุ่มของแถว — หน้าจอวาดหัวกลุ่มคั่นเมื่อกลุ่มเปลี่ยน
   * ตารางโตเป็น 22 แถวตั้งแต่เฟส 4 การกวาดตาหาค่าจึงต้องมีที่พัก (US-30, US-31)
   */
  group?: string
}

/** ดัชนีเงินเฟ้อไทยและสถานะของตัวเลือกปรับเงินเฟ้อ (US-15) */
export type InflationInput = {
  rates: InflationRate[]
  enabled: boolean
}

export type Summary = {
  rows: SummaryRow[]
  months: number
  /** ปีที่ยังไม่มีดัชนีเงินเฟ้อประกาศ — ว่างเสมอเมื่อไม่ได้เปิดตัวเลือก (BR-INF-09) */
  inflationGapYears: number[]
}

const DIRECTION: Record<string, Direction> = {
  endBalance: "higher-better",
  cagr: "higher-better",
  moneyWeightedReturn: "higher-better",
  stdev: "closer-to-zero-better",
  bestYear: "higher-better",
  worstYear: "higher-better",
  maxDrawdown: "closer-to-zero-better",
  sharpe: "higher-better",
  sortino: "higher-better",

  // เทียบกับตลาด (US-30)
  beta: "none",
  alpha: "higher-better",
  rSquared: "none",
  trackingError: "none",
  informationRatio: "higher-better",
  upsideCapture: "higher-better",
  // ตามตลาดขาลงน้อยกว่า = ทนขาลงได้ดีกว่า
  downsideCapture: "closer-to-zero-better",

  // ความเสี่ยงหางและรูปร่างการกระจาย (US-31)
  varHistorical: "closer-to-zero-better",
  varAnalytical: "closer-to-zero-better",
  cvar: "closer-to-zero-better",
  skewness: "none",
  kurtosis: "none",
  calmar: "higher-better",
}

/**
 * ประกอบตารางสรุปจากผลตอบแทนรายเดือน (BR-SUM-02, BR-SUM-03)
 *
 * ทุกค่ามาจากชั้นคำนวณ ฟังก์ชันนี้ทำได้แค่จัดเรียงและเทียบทิศ — ไม่มีการคำนวณใหม่
 * ผลตอบแทนของตัวเทียบต้องถูกตัดให้เป็นช่วงเดียวกับพอร์ตมาแล้ว มิฉะนั้นจะเป็นการเทียบคนละช่วง
 */
/** ผลจากชั้นคำนวณของหนึ่งพอร์ต ที่แถวเงินเข้าออกและการปรับสมดุลต้องใช้ */
export type PortfolioOutcome = {
  returns: MonthlyReturn[]
  /** มูลค่าสุดท้ายจากเส้นมูลค่าที่รวมเงินเข้าออกแล้ว (BR-CMP-41) */
  endValue: number
  contributed: number
  withdrawn: number
  hasCashflow: boolean
  moneyWeighted: number | null
  rebalanceCount: number
  /** true เมื่อพอร์ตนี้ตั้งวิธีปรับสมดุลไว้ไม่ตรงกับค่าปริยาย */
  customRebalance: boolean
}

export function assembleSummary(input: {
  /** ผลของแต่ละพอร์ต ตัดให้เป็นช่วงเวลาร่วมเดียวกันมาแล้ว (BR-CMP-04) */
  outcomes: PortfolioOutcome[]
  benchmark: MonthlyReturn[]
  riskFree: MonthlyReturn[]
  amount: number
  inflation?: InflationInput
}): Summary {
  const { outcomes, benchmark, riskFree, amount, inflation } = input
  const portfolios = outcomes.map((o) => o.returns)
  const adjusting = inflation?.enabled === true
  const rates = inflation?.rates ?? []

  /**
   * ค่าที่หักเงินเฟ้อได้ของหนึ่งชุดผลตอบแทน (BR-INF-04)
   * ตัวคูณสะสมคิดจากปีที่ชุดนั้นแตะเอง เพราะพอร์ตกับตัวเทียบอาจมีเดือนไม่เท่ากัน
   *
   * `endValue` แยกจาก `series` เพราะมูลค่าสุดท้ายมาจากเส้นมูลค่าที่รวมเงินเข้าออกแล้ว (BR-CMP-41)
   * ส่วนผลตอบแทนต่อปีแบบทบต้นยังคิดจากชุดผลตอบแทนล้วน ๆ ซึ่งไม่ขึ้นกับเงินเข้าออก (BR-CMP-40)
   */
  const deflate = (series: MonthlyReturn[], endValue = endBalance(series, amount)) => {
    if (!adjusting) {
      return { endBalance: endValue, cagr: cagr(series), missingYears: [] as number[] }
    }
    const { factor, missingYears } = cumulativeInflation(coveredYears(series), rates)
    return {
      endBalance: realEndBalance(endValue, factor),
      cagr: realCagr(realEndBalance(endBalance(series, amount), factor), amount, series.length),
      missingYears,
    }
  }

  const yearly = (series: MonthlyReturn[]) => {
    const annual = annualReturns(series)
    return bestWorstFullYears(adjusting ? realAnnualReturns(annual, rates) : annual)
  }

  const totals = outcomes.map((outcome) => deflate(outcome.returns, outcome.endValue))
  const annual = portfolios.map(yearly)
  const drawdowns = portfolios.map(maxDrawdown)
  const sortinos = portfolios.map((series) => sortino(series, riskFree))

  const benchmarkTotals = deflate(benchmark)
  const benchmarkAnnual = yearly(benchmark)
  const benchmarkDrawdown = maxDrawdown(benchmark)

  // ค่าความเสี่ยงทุกตัวยังเป็นตัวเงินปกติ เพราะนิยามบนผลตอบแทนรายเดือน
  // ซึ่งดัชนีเงินเฟ้อรายปีไม่มีความละเอียดพอจะปรับได้ (BR-INF-08)
  // สามแถวนี้โผล่เฉพาะเมื่อมีพอร์ตที่ใช้ความสามารถนั้นจริง ไม่ใช่โผล่ตลอด (BR-CMP-46)
  const anyCashflow = outcomes.some((o) => o.hasCashflow)
  const anyCustomRebalance = outcomes.some((o) => o.customRebalance)
  const withdrawing = outcomes.some((o) => o.withdrawn > 0)

  /** คำนวณค่าหนึ่งตัวให้ทุกพอร์ต แล้วห่อเป็นช่องของตาราง */
  const relative = (compute: (series: MonthlyReturn[]) => number | null) =>
    portfolios.map((series) => ({ value: compute(series) }))

  const rows: SummaryRow[] = [
    row("startAmount", "money", portfolios.map(() => ({ value: amount })), amount),
    ...(anyCashflow
      ? [
          row(
            withdrawing ? "totalWithdrawn" : "totalContributed",
            "money",
            outcomes.map((o) => ({
              value: o.hasCashflow ? (withdrawing ? o.withdrawn : amount + o.contributed) : null,
            })),
            null,
          ),
        ]
      : []),
    adjusted(
      row(
        "endBalance",
        "money",
        totals.map((t) => ({ value: t.endBalance })),
        benchmarkTotals.endBalance,
      ),
    ),
    adjusted(
      row("cagr", "percent", totals.map((t) => ({ value: t.cagr })), benchmarkTotals.cagr),
    ),
    // ผลตอบแทนของ "เงินคุณ" อยู่ติดกับผลตอบแทนของ "พอร์ต" เพื่อให้เห็นความต่างทันที (BR-CMP-47)
    ...(anyCashflow
      ? [
          row(
            "moneyWeightedReturn",
            "percent",
            outcomes.map((o) => ({
              value: o.hasCashflow ? o.moneyWeighted : null,
              unavailableReason:
                o.hasCashflow && o.moneyWeighted === null ? "summary.noMoneyWeighted" : undefined,
            })),
            null,
          ),
        ]
      : []),
    row(
      "stdev",
      "percent",
      portfolios.map((series) => ({ value: annualizedStdev(series) })),
      annualizedStdev(benchmark),
    ),
    adjusted({
      ...row(
        "bestYear",
        "percent",
        annual.map((a) => ({ value: a.best?.value ?? null, year: a.best?.year })),
        benchmarkAnnual.best?.value ?? null,
      ),
      benchmarkYear: benchmarkAnnual.best?.year,
    }),
    adjusted({
      ...row(
        "worstYear",
        "percent",
        annual.map((a) => ({ value: a.worst?.value ?? null, year: a.worst?.year })),
        benchmarkAnnual.worst?.value ?? null,
      ),
      benchmarkYear: benchmarkAnnual.worst?.year,
    }),
    row(
      "maxDrawdown",
      "percent",
      drawdowns.map((d) => ({ value: d?.depth ?? null })),
      benchmarkDrawdown?.depth ?? null,
    ),
    row(
      "sharpe",
      "ratio",
      portfolios.map((series) => ({ value: sharpe(series, riskFree) })),
      sharpe(benchmark, riskFree),
    ),
    row(
      "sortino",
      "ratio",
      sortinos.map((value) => ({
        value,
        unavailableReason: value === null ? "summary.noDownside" : undefined,
      })),
      sortino(benchmark, riskFree),
    ),
    ...(anyCustomRebalance
      ? [
          row(
            "rebalanceCount",
            "count",
            outcomes.map((o) => ({ value: o.rebalanceCount })),
            null,
          ),
        ]
      : []),

    /**
     * เทียบกับตลาด (US-30) — ทุกค่าคิดจากผลตอบแทน**ดิบ** ([PD-024](../../../docs/product/decision-log.md))
     * ค่าของคอลัมน์ตัวเทียบคือตัวเทียบเทียบกับตัวเอง ซึ่งต้องได้ Beta 1 · Alpha 0 · R² 100%
     * · capture 100% เสมอ (BR-RSK-18)
     */
    row("beta", "ratio", relative((series) => beta(series, benchmark)), 1, RELATIVE_GROUP),
    row("alpha", "percent", relative((series) => alpha(series, benchmark)), 0, RELATIVE_GROUP),
    row("rSquared", "percent", relative((series) => rSquared(series, benchmark)), 1, RELATIVE_GROUP),
    row(
      "trackingError",
      "percent",
      relative((series) => trackingError(series, benchmark)),
      0,
      RELATIVE_GROUP,
    ),
    row(
      "informationRatio",
      "ratio",
      relative((series) => informationRatio(series, benchmark)),
      null,
      RELATIVE_GROUP,
    ),
    row(
      "upsideCapture",
      "percent",
      relative((series) => captureRatios(series, benchmark).upside),
      1,
      RELATIVE_GROUP,
    ),
    row(
      "downsideCapture",
      "percent",
      relative((series) => captureRatios(series, benchmark).downside),
      1,
      RELATIVE_GROUP,
    ),

    /**
     * ความเสี่ยงหางและรูปร่างการกระจาย (US-31)
     * **สามค่าแรกเป็นค่าต่อเดือน ไม่ใช่ต่อปี** — คำอธิบายในทะเบียนศัพท์บอกไว้แล้ว (BR-RSK-24)
     */
    row("varHistorical", "percent", relative(historicalVaR), historicalVaR(benchmark), TAIL_GROUP),
    row("varAnalytical", "percent", relative(analyticalVaR), analyticalVaR(benchmark), TAIL_GROUP),
    row("cvar", "percent", relative(conditionalVaR), conditionalVaR(benchmark), TAIL_GROUP),
    row("skewness", "ratio", relative(skewness), skewness(benchmark), TAIL_GROUP),
    row("kurtosis", "ratio", relative(excessKurtosis), excessKurtosis(benchmark), TAIL_GROUP),
    row("calmar", "ratio", relative(calmar), calmar(benchmark), TAIL_GROUP),
  ]

  const inflationGapYears = [
    ...new Set([...totals.flatMap((t) => t.missingYears), ...benchmarkTotals.missingYears]),
  ].sort((a, b) => a - b)

  // ทุกพอร์ตอยู่บนช่วงเวลาร่วมเดียวกันแล้ว จำนวนเดือนจึงเท่ากันทุกชุด
  return { rows, months: portfolios[0]?.length ?? 0, inflationGapYears }

  function adjusted(target: SummaryRow): SummaryRow {
    return adjusting ? { ...target, adjusted: true } : target
  }
}

function row(
  metric: string,
  format: MetricFormat,
  cells: Array<{ value: number | null; year?: number; unavailableReason?: string }>,
  benchmark: number | null,
  group?: string,
): SummaryRow {
  return {
    metric,
    format,
    benchmark,
    ...(group ? { group } : {}),
    portfolios: cells.map((cell) => ({
      ...cell,
      comparison: compare(metric, cell.value, benchmark),
    })),
  }
}

function compare(
  metric: string,
  portfolio: number | null,
  benchmark: number | null,
): SummaryCell["comparison"] {
  if (portfolio === null || benchmark === null) return null
  // เงินตั้งต้นเท่ากันเสมอ ไม่ต้องเทียบ
  if (metric === "startAmount") return null

  const direction = DIRECTION[metric] ?? "higher-better"
  // ค่าที่ไม่มีทิศ "ดีกว่า" ไม่ต้องติดป้ายเทียบ — ปล่อยให้ผู้ใช้ตีความเอง (ต่อจาก BR-CMP-23)
  if (direction === "none") return null
  const [a, b] =
    direction === "closer-to-zero-better"
      ? [Math.abs(portfolio), Math.abs(benchmark)]
      : [portfolio, benchmark]

  // ต่างกันน้อยกว่าที่ปัดแล้วจะเห็น ถือว่าเท่ากัน
  if (Math.abs(a - b) < 1e-9) return "equal"
  if (direction === "closer-to-zero-better") return a < b ? "better" : "worse"
  return a > b ? "better" : "worse"
}
