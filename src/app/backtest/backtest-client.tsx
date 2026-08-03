"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PortfolioForm } from "@/components/backtest/portfolio-form"
import { RunStatus, type RunState } from "@/components/backtest/run-status"
import { getBrowserProvider } from "@/data/providers/browser"
import { loadPortfolioSeries } from "@/data/market/load-portfolio"
import { track } from "@/data/analytics/ga"
import { decodeConfig, defaultConfig, encodeConfig, isEmptyParams } from "@/lib/backtest/url"
import {
  filledRows,
  hasIssues,
  retainIssues,
  validateConfig,
  NO_ISSUES,
  type FormIssues,
} from "@/lib/backtest/validation"
import {
  buildAnnualData,
  buildDrawdownData,
  buildGrowthData,
  buildMonthlyData,
} from "@/lib/backtest/chart-data"
import { buildRollingData } from "@/lib/backtest/rolling-data"
import { buildRiskData } from "@/lib/backtest/risk-data"
import { buildPhase4Data } from "@/lib/backtest/phase4-data"
import { assembleSummary, type PortfolioOutcome } from "@/lib/backtest/summary"
import {
  buildFlows,
  commonRange,
  moneyWeightedReturn,
  portfolioReturns,
  type CashflowPlan,
} from "@/engine"
import cpiFixture from "@/data/fixtures/th-cpi.json"
import rfFixture from "@/data/fixtures/rf.json"
import { useLanguage } from "@/i18n"
import { DEFAULT_REBALANCE, type BacktestConfig, type CashflowSpec } from "@/types/backtest"
import { parseYearMonth, type MonthRange } from "@/types/series"

const provider = getBrowserProvider()
const LAST_CLOSED_MONTH = provider.lastClosedMonth()
const LAST_CLOSED_YEAR = Number(LAST_CLOSED_MONTH.split("-")[0])

/** อัตราปราศจากความเสี่ยงชุดที่ freeze ไว้ ใช้คำนวณ Sharpe และ Sortino (BR-ENG-11) */
const RISK_FREE = rfFixture.returns
/** อัตราเงินเฟ้อไทยรายปีชุดที่ freeze ไว้ — ใช้ชุดนี้เสมอไม่ว่าเลือกดูผลเป็นสกุลใด (BR-INF-11) */
const INFLATION_RATES = cpiFixture.rates

/** แปลงค่าที่ผู้ใช้กรอก (เก็บเป็นข้อความ) เป็นแผนที่ชั้นคำนวณใช้ */
function toCashflowPlan(spec: CashflowSpec | null): CashflowPlan | null {
  if (!spec) return null
  return {
    direction: spec.direction,
    amount: Number(spec.amount),
    basis: spec.basis,
    frequency: spec.frequency,
    inflationAdjusted: spec.inflationAdjusted,
    allocation: spec.allocation,
  }
}

/** เงินที่ใส่สะสมของแต่ละเดือน รวมเงินตั้งต้น — จุดแรกคือก่อนเดือนแรก (AC-CMP-31) */
function cumulative(initialAmount: number, deposits: number[]): number[] {
  let running = initialAmount
  return [initialAmount, ...deposits.map((amount) => (running += amount))]
}


export function BacktestClient() {
  const params = useSearchParams()
  const urlKey = params.toString()

  const fromUrl = isEmptyParams(params)
    ? { ok: true as const, config: defaultConfig(LAST_CLOSED_YEAR) }
    : decodeConfig(params, LAST_CLOSED_YEAR)

  /**
   * ผูก session กับค่าในลิงก์ด้วย key — เปลี่ยนลิงก์เมื่อไหร่ ฟอร์มเริ่มใหม่จากค่าในลิงก์เสมอ
   * ทำให้ไม่มีทางที่ค่าที่มาช้ากว่าการวาดครั้งแรกจะทำให้จอค้างที่ค่าเริ่มต้น (BR-URL-08)
   */
  return (
    <BacktestSession
      key={urlKey}
      urlKey={urlKey}
      initialConfig={fromUrl.ok ? fromUrl.config : fromUrl.partial}
      linkBroken={!fromUrl.ok}
      autoRun={fromUrl.ok && !isEmptyParams(params)}
    />
  )
}

type SessionProps = {
  urlKey: string
  initialConfig: BacktestConfig
  linkBroken: boolean
  autoRun: boolean
}

function BacktestSession({ urlKey, initialConfig, linkBroken: initialLinkBroken, autoRun }: SessionProps) {
  const router = useRouter()
  const { t } = useLanguage()

  const [config, setConfig] = useState<BacktestConfig>(initialConfig)
  const [issues, setIssues] = useState<FormIssues | null>(null)
  const [linkBroken, setLinkBroken] = useState(initialLinkBroken)
  const [unknownSymbols, setUnknownSymbols] = useState<Set<string>>(new Set())
  const [checking, setChecking] = useState(false)
  const [run, setRun] = useState<RunState>({ kind: "idle" })

  // นับลำดับคำขอ เพื่อให้ผลของคำขอเก่าไม่ทับผลล่าสุด (EC-CFG-06, EC-SUM-05)
  const runSeq = useRef(0)

  const executeRun = useCallback(
    async (target: BacktestConfig) => {
      const seq = ++runSeq.current
      setRun({ kind: "loading" })

      const rowsPerPortfolio = target.portfolios.map((p) => filledRows(p.assets))
      const range: MonthRange = {
        start: `${target.startYear}-01`,
        end: `${target.endYear}-12`,
      }

      // สัญลักษณ์เดียวกันที่อยู่ในหลายพอร์ตดึงรอบเดียว (BR-CMP-06)
      const symbols = [
        ...new Set(rowsPerPortfolio.flat().map((r) => r.symbol.trim().toUpperCase())),
      ]

      // ชั้นข้อมูลดึงและแปลงค่าเงินให้เป็นสกุลเดียวกันมาแล้ว หน้าจอไม่แปลงเอง (BR-THB-03)
      const loaded = await loadPortfolioSeries({
        provider,
        symbols,
        benchmark: target.benchmark,
        range,
        base: target.baseCurrency,
      })
      if (seq !== runSeq.current) return

      if (!loaded.ok) {
        if (loaded.reason === "symbol-not-found") {
          setUnknownSymbols((prev) => new Set([...prev, ...loaded.symbols]))
          setRun({ kind: "idle" })
          return
        }
        setRun({
          kind: "error",
          messageKey: loaded.reason === "fx-unreachable" ? "error.fxLoad" : "error.dataLoad",
          params:
            loaded.reason === "unreachable" ? { symbol: loaded.symbols.join(", ") } : undefined,
          retryable: true,
        })
        return
      }

      const holdings = rowsPerPortfolio.map((rows) =>
        rows.map((row) => {
          const symbol = row.symbol.trim().toUpperCase()
          return { symbol, weight: Number(row.weight), returns: loaded.bySymbol.get(symbol) ?? [] }
        }),
      )

      /**
       * ช่วงเวลาร่วมต้องตัดสิน **ก่อน** คำนวณพอร์ต ไม่ใช่ตัดผลลัพธ์ทีหลัง (BR-CMP-04)
       * เพราะน้ำหนักลอยและถูกดึงกลับตามรอบ — ตัดทีหลังจะได้ค่าของพอร์ตที่น้ำหนักลอยมา
       * จากเดือนที่ไม่ได้อยู่ในช่วงร่วม ซึ่งไม่ใช่คำตอบของคำถามที่ผู้ใช้ถาม
       */
      const shared = commonRange(holdings.flat())
      if (!shared) {
        setRun({ kind: "error", messageKey: "error.noOverlap", retryable: false })
        return
      }

      const inRange = (series: { month: string; value: number }[]) =>
        series.filter((item) => item.month >= shared.range.start && item.month <= shared.range.end)

      const results = holdings.map((assets, i) =>
        portfolioReturns(assets.map((a) => ({ ...a, returns: inRange(a.returns) })), {
          rebalance: target.portfolios[i].rebalance,
          bandPoints: Number(target.portfolios[i].bandPoints),
          initialAmount: target.amount,
          cashflow: toCashflowPlan(target.portfolios[i].cashflow),
          inflationRates: INFLATION_RATES,
        }),
      )

      if (results.some((r) => !r.usedRange || r.returns.length === 0)) {
        setRun({ kind: "error", messageKey: "error.noOverlap", retryable: false })
        return
      }
      if (results[0].returns.length < 2) {
        setRun({ kind: "error", messageKey: "validation.rangeTooShort", retryable: false })
        return
      }

      const askedStart = `${target.startYear}-01`
      // ข้อความนี้ขึ้นเฉพาะตอน**ต้นช่วง**ขยับ จึงต้องบอกชื่อตัวที่จำกัดต้นช่วง
      // ไม่ใช่ตัวแรกใน limitedBy ซึ่งอาจเป็นตัวที่จำกัดท้ายช่วงแทน
      const clampedBy =
        shared.range.start > askedStart && shared.limitedStartBy.length > 0
          ? { symbol: shared.limitedStartBy[0] }
          : undefined

      const portfolioSeries = results.map((r) => r.returns)
      const benchmarkReturns = inRange(loaded.benchmark)
      const inflation = { rates: INFLATION_RATES, enabled: target.inflationAdjusted }

      const outcomes: PortfolioOutcome[] = results.map((result, i) => {
        const spec = target.portfolios[i]
        const hasCashflow = spec.cashflow !== null
        const endValue = result.values.at(-1)?.value ?? target.amount
        return {
          returns: result.returns,
          endValue,
          contributed: result.deposits.reduce((sum, v) => sum + v, 0),
          withdrawn: result.withdrawals.reduce((sum, v) => sum + v, 0),
          hasCashflow,
          moneyWeighted: hasCashflow
            ? moneyWeightedReturn(
                buildFlows({
                  initialAmount: target.amount,
                  deposits: result.deposits,
                  withdrawals: result.withdrawals,
                  finalValue: endValue,
                }),
              )
            : null,
          rebalanceCount: result.rebalanceCount,
          customRebalance: spec.rebalance !== DEFAULT_REBALANCE,
        }
      })

      const summary = assembleSummary({
        outcomes,
        benchmark: benchmarkReturns,
        riskFree: inRange(RISK_FREE),
        amount: target.amount,
        inflation,
      })

      const depletedAt = results.find((r) => r.depletedAt !== null)?.depletedAt ?? null

      setRun({
        kind: "ready",
        summary,
        // สกุลเงินและตัวเลือกปรับเงินเฟ้อมาจากค่าที่ใช้รันจริง ไม่ใช่ค่าที่กำลังเลือกอยู่ในฟอร์ม
        // หน่วยและคำกำกับบนจอจึงไม่เปลี่ยนก่อนตัวเลขชุดใหม่จะมา (EC-CUR-02)
        currency: target.baseCurrency,
        converted: loaded.converted,
        inflationAdjusted: target.inflationAdjusted,
        portfolioNames: target.portfolios.map((p) => p.name),
        depletedAt,
        allocationTarget: target.portfolios.some(
          (p) => p.cashflow?.direction === "deposit" && p.cashflow.allocation === "target",
        ),
        growth: buildGrowthData(portfolioSeries, benchmarkReturns, target.amount, {
          values: results.map((r) => r.values),
          contributions: results.map((r, i) =>
            target.portfolios[i].cashflow ? cumulative(target.amount, r.deposits) : null,
          ),
        }),
        annual: buildAnnualData(portfolioSeries, benchmarkReturns, inflation),
        drawdown: buildDrawdownData(portfolioSeries, benchmarkReturns),
        // คิดจากชุดผลตอบแทนของพอร์ตล้วน ๆ จึงไม่รับทั้งเงินเข้าออกและตัวเลือกเงินเฟ้อ (BR-CMP-70)
        rolling: buildRollingData(portfolioSeries),
        /**
         * ตารางรายสินทรัพย์ (US-28, US-29) — ใช้ชุดผลตอบแทนรายตัวที่ตัดช่วงร่วมมาแล้ว
         * ซึ่งเป็นวัตถุดิบเดียวกับที่ `portfolioReturns` ได้รับ บวกน้ำหนักรายเดือนที่มันคืนมา
         */
        risk: buildRiskData(
          results.map((result, i) => ({
            assets: holdings[i].map((asset) => ({
              symbol: asset.symbol,
              weight: asset.weight,
              returns: inRange(asset.returns),
            })),
            monthlyWeights: result.weights,
            returns: result.returns,
            profit: (result.values.at(-1)?.value ?? target.amount) - target.amount - outcomes[i].contributed,
          })),
          { symbol: target.benchmark.trim().toUpperCase(), returns: benchmarkReturns },
        ),
        /**
         * ช่วงวิกฤตและอัตราถอนปลอดภัย — คิดจากชุดผลตอบแทนของพอร์ตล้วน ๆ (BR-RSK-08, BR-RSK-59)
         * จึงไม่รับทั้งเงินเข้าออกที่ผู้ใช้ตั้งไว้และตัวเลือกปรับเงินเฟ้อ
         */
        phase4: buildPhase4Data({
          portfolios: portfolioSeries,
          benchmark: benchmarkReturns,
          inflationRates: INFLATION_RATES,
        }),
        amount: target.amount,
        monthly: buildMonthlyData(portfolioSeries, benchmarkReturns),
        range: shared.range,
        benchmarkSymbol: target.benchmark.trim().toUpperCase(),
        clamped: clampedBy,
      })

      /**
       * นับเฉพาะตอนที่ผลลัพธ์ขึ้นสำเร็จ (BR-USE-07) — ทุกทางที่ออกก่อนถึงบรรทัดนี้คือกดแล้วพัง
       * ซึ่งไม่ใช่การใช้งาน ถ้านับด้วยอัตราที่ได้จะสูงเกินจริง
       *
       * ส่งรูปร่างเท่านั้น ไม่ส่งจำนวนเงินและไม่ส่งสัญลักษณ์ที่ผู้ใช้กรอก (BR-USE-01)
       */
      const portfolioCount = target.portfolios.length as 1 | 2 | 3
      track("run_backtest", {
        portfolio_count: portfolioCount,
        base_currency: target.baseCurrency,
        span_years: target.endYear - target.startYear + 1,
        inflation_adjusted: target.inflationAdjusted,
        has_cashflow: target.portfolios.some((p) => p.cashflow !== null),
      })
      if (portfolioCount > 1) {
        track("compare_portfolios", { portfolio_count: portfolioCount as 2 | 3 })
      }
    },
    [],
  )

  const validateAndRun = useCallback(
    (target: BacktestConfig) => {
      const next = validateConfig(target, {
        lastClosedYear: LAST_CLOSED_YEAR,
        unknownSymbols,
      })
      setIssues(next)
      if (hasIssues(next)) {
        setRun({ kind: "idle" })
        return false
      }
      void executeRun(target)
      return true
    },
    [executeRun, unknownSymbols],
  )

  /**
   * แก้ค่าในฟอร์ม — ข้อความที่แก้ถูกแล้วหายทันที แต่ปัญหาที่เพิ่งเกิดระหว่างพิมพ์ไม่โผล่ขึ้นมา
   * ([PD-018](../../../docs/product/decision-log.md))
   *
   * ก่อนกดรันครั้งแรก `issues` ยังเป็น null ฟอร์มจึงเงียบสนิทเหมือนเดิม (BR-FRM-15)
   * `validateConfig` เป็นฟังก์ชันบริสุทธิ์ จึงเรียกทุกครั้งที่ค่าเปลี่ยนได้โดยไม่มีผลข้างเคียง
   */
  const handleConfigChange = useCallback(
    (next: BacktestConfig) => {
      setConfig(next)
      setIssues((current) =>
        current === null
          ? null
          : retainIssues(
              current,
              validateConfig(next, { lastClosedYear: LAST_CLOSED_YEAR, unknownSymbols }),
            ),
      )
    },
    [unknownSymbols],
  )

  // เปิดลิงก์ที่มีค่าครบ → รันเองทันทีโดยผู้ใช้ไม่ต้องกด (BR-URL-05)
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !autoRun) return
    started.current = true
    validateAndRun(initialConfig)
  }, [autoRun, initialConfig, validateAndRun])

  const handleSubmit = () => {
    setLinkBroken(false)
    if (!validateAndRun(config)) return

    const query = encodeConfig(config)
    // ค่าเดิมไม่ต้องเพิ่มรายการย้อนกลับซ้ำ (BR-URL-04)
    if (query === urlKey) return
    router.push(`/backtest?${query}`)
  }

  /**
   * ล้างทุกอย่างกลับเป็นค่าเริ่มต้น (US-35)
   *
   * ทางหลักคือ**เปลี่ยนลิงก์ไปที่ `/backtest` เปล่า** แล้วปล่อยให้ค่าในลิงก์เป็นตัวตั้งต้น
   * ของทุกอย่างตาม BR-URL-08 — ได้ล้างครบทั้งฟอร์ม ผล ข้อความตรวจสอบ และสัญลักษณ์ที่หาไม่เจอ
   * โดยไม่ต้องเขียนทางล้างเส้นที่สอง · การเปลี่ยนลิงก์สร้างรายการย้อนกลับให้เอง
   * ปุ่มย้อนกลับจึงเป็นปุ่มเลิกทำ ([PD-022](../../../docs/product/decision-log.md))
   *
   * **ต้องใช้การเปลี่ยนหน้าเต็มรูปแบบ ไม่ใช่ `router.push`** — บนรุ่นที่ build แล้ว หน้านี้ถูก
   * สร้างเป็นหน้านิ่งไว้ล่วงหน้า การสั่ง `router.push("/backtest")` ตอนที่อยู่ที่ `/backtest`
   * อยู่แล้ว (ต่างกันแค่ค่าท้ายลิงก์) จึงถูกมองว่าไปที่เดิมแล้วไม่เกิดอะไรขึ้นเลย ·
   * บน `next dev` มันทำงานปกติ ความต่างนี้จึงโผล่เฉพาะบนรุ่นจริง
   *
   * ถ้าอยู่ที่ลิงก์เปล่าอยู่แล้วให้ล้างในที่แทน จะได้ไม่โหลดหน้าใหม่โดยไม่จำเป็น
   * และไม่เพิ่มรายการย้อนกลับที่ไม่มีความหมาย (EC-LOOP-05, EC-LOOP-07)
   */
  const handleReset = () => {
    if (urlKey !== "") {
      window.location.href = "/backtest"
      return
    }
    setConfig(defaultConfig(LAST_CLOSED_YEAR))
    setIssues(null)
    setUnknownSymbols(new Set())
    setLinkBroken(false)
    setRun({ kind: "idle" })
  }

  const handleSymbolBlur = async (raw: string) => {
    const symbol = raw.trim().toUpperCase()
    if (symbol === "" || unknownSymbols.has(symbol)) return

    setChecking(true)
    const result = await provider.getMonthlySeries(symbol, {
      start: LAST_CLOSED_MONTH,
      end: LAST_CLOSED_MONTH,
    })
    setChecking(false)

    if (!result.ok && result.failure.kind === "symbol-not-found") {
      const next = new Set([...unknownSymbols, symbol])
      setUnknownSymbols(next)
      setIssues(
        validateConfig(config, { lastClosedYear: LAST_CLOSED_YEAR, unknownSymbols: next }),
      )
      return
    }
    // ตรวจซ้ำเฉพาะเมื่อเคยมีข้อความค้างอยู่ จะได้ไม่ขึ้น error ทั้งฟอร์มตั้งแต่ยังกรอกไม่เสร็จ
    if (issues) {
      setIssues(validateConfig(config, { lastClosedYear: LAST_CLOSED_YEAR, unknownSymbols }))
    }
  }

  const lastClosedLabel = (() => {
    const { year, month } = parseYearMonth(LAST_CLOSED_MONTH)
    return `${t(`months.${month}`)} ${year}`
  })()

  const shownIssues: FormIssues = issues
    ? {
        ...issues,
        endYear:
          issues.endYear?.code === "V-005"
            ? { code: "V-005", params: { lastMonth: lastClosedLabel } }
            : issues.endYear,
      }
    : NO_ISSUES

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("form.heading")}</h1>

      {linkBroken ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{t("validation.linkInvalid")}</AlertDescription>
        </Alert>
      ) : null}

      <PortfolioForm
        config={config}
        issues={shownIssues}
        checkingSymbols={checking}
        submitting={run.kind === "loading"}
        lastClosedYear={LAST_CLOSED_YEAR}
        onChange={handleConfigChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
        onSymbolBlur={handleSymbolBlur}
      />

      <RunStatus state={run} onRetry={() => validateAndRun(config)} />
    </div>
  )
}
