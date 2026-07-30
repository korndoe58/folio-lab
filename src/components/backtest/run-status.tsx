"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AnnualData, DrawdownData, GrowthData } from "@/lib/backtest/chart-data"
import type { Summary } from "@/lib/backtest/summary"
import type { Currency } from "@/data/currency"
import { useLanguage } from "@/i18n"
import { parseYearMonth, type MonthRange } from "@/types/series"
import { AnnualSection } from "./annual-section"
import { DrawdownSection } from "./drawdown-section"
import { GrowthChart } from "./growth-chart"
import { SummaryTable } from "./summary-table"

export type RunState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "ready"
      summary: Summary
      growth: GrowthData
      annual: AnnualData
      drawdown: DrawdownData
      range: MonthRange
      benchmarkSymbol: string
      currency: Currency
      /** true เมื่อมีสินทรัพย์ถูกแปลงค่าเงิน — ต้องบอกผู้ใช้ตาม BR-CUR-05 */
      converted: boolean
      /** true เมื่อผลชุดนี้หักเงินเฟ้อไทยแล้ว (US-15) */
      inflationAdjusted: boolean
      clamped?: { symbol: string }
    }
  | { kind: "error"; messageKey: string; params?: Record<string, string>; retryable: boolean }

export function RunStatus({ state, onRetry }: { state: RunState; onRetry: () => void }) {
  const { t } = useLanguage()

  const monthLabel = (month: string) => {
    const { year, month: m } = parseYearMonth(month)
    return `${t(`months.${m}`)} ${year}`
  }

  if (state.kind === "idle") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("result.emptyTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("result.emptyHint")}</p>
        </CardContent>
      </Card>
    )
  }

  if (state.kind === "loading") {
    // โครงร่างของตาราง ไม่ใช่วงกลมหมุน (BR-SUM-09)
    return (
      <Card aria-busy="true">
        <CardHeader>
          <CardTitle className="text-base">{t("result.loading")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (state.kind === "error") {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{t(state.messageKey, state.params)}</span>
          {state.retryable ? (
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              {t("result.retry")}
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ประกาศให้โปรแกรมอ่านหน้าจอรู้ว่าผลพร้อมแล้ว (AC-SUM-10) */}
      <p role="status" className="sr-only">
        {t("summary.ready")}
      </p>

      {state.converted ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("notice.converted", { currency: t(`currency.${state.currency}.inline`) })}
        </p>
      ) : null}

      {state.inflationAdjusted ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("notice.inflationOn")}
        </p>
      ) : null}

      {state.inflationAdjusted && state.summary.inflationGapYears.length > 0 ? (
        // N-003 — บอกว่าปีไหนยังไม่ถูกปรับ ไม่ใช่บอกว่าคำนวณผิดพลาด (BR-INF-09)
        <p className="text-sm text-muted-foreground" role="status">
          {t("notice.inflationGap", { years: state.summary.inflationGapYears.join(", ") })}
        </p>
      ) : null}

      <SummaryTable
        summary={state.summary}
        range={state.range}
        benchmarkSymbol={state.benchmarkSymbol}
        currency={state.currency}
      />

      <GrowthChart
        data={state.growth}
        benchmarkSymbol={state.benchmarkSymbol}
        currency={state.currency}
        inflationAdjusted={state.inflationAdjusted}
      />

      <AnnualSection
        data={state.annual}
        benchmarkSymbol={state.benchmarkSymbol}
        inflationAdjusted={state.inflationAdjusted}
      />

      <DrawdownSection data={state.drawdown} benchmarkSymbol={state.benchmarkSymbol} />

      {state.clamped ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("notice.rangeClamped", {
            start: monthLabel(state.range.start),
            end: monthLabel(state.range.end),
            symbol: state.clamped.symbol,
          })}
        </p>
      ) : null}
    </div>
  )
}
