"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AnnualData, DrawdownData, GrowthData, MonthlyRow } from "@/lib/backtest/chart-data"
import type { RollingData } from "@/lib/backtest/rolling-data"
import type { RiskData } from "@/lib/backtest/risk-data"
import type { Phase4Data } from "@/lib/backtest/phase4-data"
import type { Summary } from "@/lib/backtest/summary"
import { resolvePortfolioNames } from "@/lib/backtest/portfolio-names"
import type { Currency } from "@/data/currency"
import { useLanguage } from "@/i18n"
import { parseYearMonth, type MonthRange } from "@/types/series"
import { AnnualSection } from "./annual-section"
import { DrawdownSection } from "./drawdown-section"
import { GrowthChart } from "./growth-chart"
import { MonthlySection } from "./monthly-section"
import { RollingSection } from "./rolling-section"
import { CorrelationSection } from "./correlation-section"
import { DecompositionSection } from "./decomposition-section"
import { StressSection } from "./stress-section"
import { WithdrawalSection } from "./withdrawal-section"
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
      rolling: RollingData
      /** ตารางรายสินทรัพย์ของ US-28 และ US-29 */
      risk: RiskData
      /** ช่วงวิกฤต (US-32) และอัตราถอนปลอดภัย (US-33) */
      phase4: Phase4Data
      /** เงินตั้งต้นที่ใช้รันจริง — อัตราถอนแปลงเป็นเงินต่อเดือนจากค่านี้ (BR-RSK-57) */
      amount: number
      monthly: MonthlyRow[]
      range: MonthRange
      benchmarkSymbol: string
      currency: Currency
      /** true เมื่อมีสินทรัพย์ถูกแปลงค่าเงิน — ต้องบอกผู้ใช้ตาม BR-CUR-05 */
      converted: boolean
      /** true เมื่อผลชุดนี้หักเงินเฟ้อไทยแล้ว (US-15) */
      inflationAdjusted: boolean
      /** ชื่อพอร์ตดิบตามที่ผู้ใช้ตั้ง เรียงตามลำดับพอร์ต — ว่างแปลว่าใช้ชื่อปริยาย */
      portfolioNames: string[]
      /** เดือนที่พอร์ตใดพอร์ตหนึ่งถูกถอนจนหมด — null เมื่อไม่มี (BR-CMP-50) */
      depletedAt: string | null
      /** true เมื่อมีพอร์ตที่กระจายเงินที่ใส่เพิ่มตามน้ำหนักเป้าหมาย (BR-CMP-59b) */
      allocationTarget: boolean
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

  const names = resolvePortfolioNames(state.portfolioNames, t)

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

      {/* บอกความต่างของสองนิยามผลตอบแทน ไม่ปล่อยให้ผู้ใช้เดา (BR-CMP-47) */}
      {state.summary.rows.some((row) => row.metric === "moneyWeightedReturn") ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("notice.twoReturns")}
        </p>
      ) : null}

      {/* วิธีนี้ปรับน้ำหนักไปในตัว ผลตอบแทนของพอร์ตจึงเทียบข้ามกันไม่ได้ตรง ๆ (AC-CMP-45) */}
      {state.allocationTarget ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("notice.allocationTarget")}
        </p>
      ) : null}

      {state.depletedAt ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("notice.portfolioDepleted", { month: monthLabel(state.depletedAt) })}
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
        portfolioNames={names}
      />

      <GrowthChart
        data={state.growth}
        benchmarkSymbol={state.benchmarkSymbol}
        currency={state.currency}
        portfolioNames={names}
        inflationAdjusted={state.inflationAdjusted}
      />

      <AnnualSection
        data={state.annual}
        benchmarkSymbol={state.benchmarkSymbol}
        portfolioNames={names}
        inflationAdjusted={state.inflationAdjusted}
      />

      <DrawdownSection
        data={state.drawdown}
        benchmarkSymbol={state.benchmarkSymbol}
        portfolioNames={names}
      />

      <RollingSection data={state.rolling} portfolioNames={names} />

      {/* สองส่วนรายสินทรัพย์ (US-28, US-29) — วางหลังหน้าต่างเลื่อน ก่อนตารางรายเดือน */}
      <CorrelationSection matrices={state.risk.correlations} portfolioNames={names} />

      <DecompositionSection
        decompositions={state.risk.decompositions}
        portfolioNames={names}
        currency={state.currency}
      />

      {/* สองส่วนสุดท้ายของเฟส 4 (US-32, US-33) */}
      <StressSection
        rows={state.phase4.stress}
        portfolioNames={names}
        benchmarkSymbol={state.benchmarkSymbol}
      />

      <WithdrawalSection
        rows={state.phase4.withdrawal}
        portfolioNames={names}
        amount={state.amount}
        currency={state.currency}
      />

      <MonthlySection
        rows={state.monthly}
        portfolioNames={names}
        benchmarkSymbol={state.benchmarkSymbol}
        range={state.range}
        currency={state.currency}
        inflationAdjusted={state.inflationAdjusted}
      />

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
