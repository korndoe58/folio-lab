"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PortfolioForm } from "@/components/backtest/portfolio-form"
import { RunStatus, type RunState } from "@/components/backtest/run-status"
import { getBrowserProvider } from "@/data/providers/browser"
import { decodeConfig, defaultConfig, encodeConfig, isEmptyParams } from "@/lib/backtest/url"
import {
  filledRows,
  hasIssues,
  validateConfig,
  type FormIssues,
} from "@/lib/backtest/validation"
import { portfolioReturns } from "@/engine"
import { useLanguage } from "@/i18n"
import type { BacktestConfig } from "@/types/backtest"
import { parseYearMonth, type MonthRange } from "@/types/series"

const provider = getBrowserProvider()
const LAST_CLOSED_MONTH = provider.lastClosedMonth()
const LAST_CLOSED_YEAR = Number(LAST_CLOSED_MONTH.split("-")[0])

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

      const rows = filledRows(target.assets)
      const symbols = [...rows.map((r) => r.symbol.trim().toUpperCase()), target.benchmark]
      const range: MonthRange = {
        start: `${target.startYear}-01`,
        end: `${target.endYear}-12`,
      }

      const results = await Promise.all(
        symbols.map((symbol) => provider.getMonthlySeries(symbol, range)),
      )
      if (seq !== runSeq.current) return

      const missing: string[] = []
      const unreachable: string[] = []
      results.forEach((result, i) => {
        if (result.ok) return
        if (result.failure.kind === "symbol-not-found") missing.push(symbols[i])
        else unreachable.push(symbols[i])
      })

      if (unreachable.length > 0) {
        setRun({
          kind: "error",
          messageKey: "error.dataLoad",
          params: { symbol: unreachable.join(", ") },
          retryable: true,
        })
        return
      }
      if (missing.length > 0) {
        setUnknownSymbols((prev) => new Set([...prev, ...missing]))
        setRun({ kind: "idle" })
        return
      }

      const assets = rows.map((row, i) => ({
        symbol: row.symbol.trim().toUpperCase(),
        weight: Number(row.weight),
        returns: results[i].ok ? results[i].series.returns : [],
      }))
      const portfolio = portfolioReturns(assets)

      if (!portfolio.usedRange || portfolio.returns.length === 0) {
        setRun({ kind: "error", messageKey: "error.noOverlap", retryable: false })
        return
      }
      if (portfolio.returns.length < 2) {
        setRun({ kind: "error", messageKey: "validation.rangeTooShort", retryable: false })
        return
      }

      const askedStart = `${target.startYear}-01`
      const clampedBy =
        portfolio.usedRange.start > askedStart && portfolio.limitedBy.length > 0
          ? { symbol: portfolio.limitedBy[0] }
          : undefined

      setRun({
        kind: "ready",
        range: portfolio.usedRange,
        months: portfolio.returns.length,
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
    : { rows: [], startYear: null, endYear: null, amount: null, benchmark: null, form: null }

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
        onChange={setConfig}
        onSubmit={handleSubmit}
        onSymbolBlur={handleSymbolBlur}
      />

      <RunStatus state={run} onRetry={() => validateAndRun(config)} />
    </div>
  )
}
