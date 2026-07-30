"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PortfolioForm } from "@/components/backtest/portfolio-form"
import { RunStatus, type RunState } from "@/components/backtest/run-status"
import { getBrowserProvider } from "@/data/providers/browser"
import { loadPortfolioSeries } from "@/data/market/load-portfolio"
import { decodeConfig, defaultConfig, encodeConfig, isEmptyParams } from "@/lib/backtest/url"
import {
  filledRows,
  hasIssues,
  validateConfig,
  NO_ISSUES,
  type FormIssues,
} from "@/lib/backtest/validation"
import { buildAnnualData, buildDrawdownData, buildGrowthData } from "@/lib/backtest/chart-data"
import { assembleSummary } from "@/lib/backtest/summary"
import { commonRange, portfolioReturns } from "@/engine"
import cpiFixture from "@/data/fixtures/th-cpi.json"
import rfFixture from "@/data/fixtures/rf.json"
import { useLanguage } from "@/i18n"
import type { BacktestConfig } from "@/types/backtest"
import { parseYearMonth, type MonthRange } from "@/types/series"

const provider = getBrowserProvider()
const LAST_CLOSED_MONTH = provider.lastClosedMonth()
const LAST_CLOSED_YEAR = Number(LAST_CLOSED_MONTH.split("-")[0])

/** อัตราปราศจากความเสี่ยงชุดที่ freeze ไว้ ใช้คำนวณ Sharpe และ Sortino (BR-ENG-11) */
const RISK_FREE = rfFixture.returns
/** อัตราเงินเฟ้อไทยรายปีชุดที่ freeze ไว้ — ใช้ชุดนี้เสมอไม่ว่าเลือกดูผลเป็นสกุลใด (BR-INF-11) */
const INFLATION_RATES = cpiFixture.rates


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

      const results = holdings.map((assets) =>
        portfolioReturns(assets.map((a) => ({ ...a, returns: inRange(a.returns) }))),
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
      const clampedBy =
        shared.range.start > askedStart && shared.limitedBy.length > 0
          ? { symbol: shared.limitedBy[0] }
          : undefined

      const portfolioSeries = results.map((r) => r.returns)
      const benchmarkReturns = inRange(loaded.benchmark)
      const inflation = { rates: INFLATION_RATES, enabled: target.inflationAdjusted }

      const summary = assembleSummary({
        portfolios: portfolioSeries,
        benchmark: benchmarkReturns,
        riskFree: inRange(RISK_FREE),
        amount: target.amount,
        inflation,
      })

      setRun({
        kind: "ready",
        summary,
        // สกุลเงินและตัวเลือกปรับเงินเฟ้อมาจากค่าที่ใช้รันจริง ไม่ใช่ค่าที่กำลังเลือกอยู่ในฟอร์ม
        // หน่วยและคำกำกับบนจอจึงไม่เปลี่ยนก่อนตัวเลขชุดใหม่จะมา (EC-CUR-02)
        currency: target.baseCurrency,
        converted: loaded.converted,
        inflationAdjusted: target.inflationAdjusted,
        portfolioNames: target.portfolios.map((p) => p.name),
        growth: buildGrowthData(portfolioSeries, benchmarkReturns, target.amount),
        annual: buildAnnualData(portfolioSeries, benchmarkReturns, inflation),
        drawdown: buildDrawdownData(portfolioSeries, benchmarkReturns),
        range: shared.range,
        benchmarkSymbol: target.benchmark.trim().toUpperCase(),
        clamped: clampedBy,
      })
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
        onChange={setConfig}
        onSubmit={handleSubmit}
        onSymbolBlur={handleSymbolBlur}
      />

      <RunStatus state={run} onRetry={() => validateAndRun(config)} />
    </div>
  )
}
