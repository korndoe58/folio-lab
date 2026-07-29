"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/i18n"
import { parseYearMonth, type MonthRange } from "@/types/series"

/**
 * แถบสถานะผลลัพธ์ขั้นต่ำของ S4 — ตารางสรุปเต็มและกราฟจะมาแทนที่ใน US-07 ถึง US-10
 * มีไว้เพื่อให้การรันจากลิงก์สาธิตได้จริงว่ามีอะไรเกิดขึ้น ไม่ใช่ปุ่มที่กดแล้วเงียบ
 */
export type RunState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; range: MonthRange; months: number; clamped?: { symbol: string } }
  | { kind: "error"; messageKey: string; params?: Record<string, string>; retryable: boolean }

export function RunStatus({ state, onRetry }: { state: RunState; onRetry: () => void }) {
  const { t } = useLanguage()

  const formatMonth = (month: string) => {
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
    return (
      <Card aria-busy="true">
        <CardHeader>
          <CardTitle className="text-base">{t("result.loading")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("result.readyTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-lg font-medium tabular-nums" data-testid="used-range">
          {t("result.rangeValue", {
            start: formatMonth(state.range.start),
            end: formatMonth(state.range.end),
          })}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("result.monthsCovered", { count: state.months })}
        </p>
        {state.clamped ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("notice.rangeClamped", {
              start: formatMonth(state.range.start),
              end: formatMonth(state.range.end),
              symbol: state.clamped.symbol,
            })}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">{t("result.moreSoon")}</p>
      </CardContent>
    </Card>
  )
}
