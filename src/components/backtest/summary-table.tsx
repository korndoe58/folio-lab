"use client"

import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatMoney, formatPercent, formatRatio } from "@/lib/backtest/format"
import type { Summary, SummaryRow } from "@/lib/backtest/summary"
import { useLanguage } from "@/i18n"
import { parseYearMonth, type MonthRange } from "@/types/series"

type Props = {
  summary: Summary
  range: MonthRange
  benchmarkSymbol: string
}

export function SummaryTable({ summary, range, benchmarkSymbol }: Props) {
  const { t } = useLanguage()

  const monthLabel = (month: string) => {
    const { year, month: m } = parseYearMonth(month)
    return `${t(`months.${m}`)} ${year}`
  }

  const show = (row: SummaryRow, column: "portfolio" | "benchmark") => {
    const value = row[column]
    if (row.format === "money") return formatMoney(value)
    if (row.format === "percent") return formatPercent(value)
    return formatRatio(value)
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="summary-heading">
      <div>
        <h2 id="summary-heading" className="text-lg font-semibold">
          {t("summary.heading")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("summary.period", {
            start: monthLabel(range.start),
            end: monthLabel(range.end),
            count: summary.months,
          })}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">
            {t("summary.heading")} — {t("summary.period", {
              start: monthLabel(range.start),
              end: monthLabel(range.end),
              count: summary.months,
            })}
          </caption>
          <thead>
            <tr className="border-b bg-muted/40">
              <th scope="col" className="px-4 py-2 text-left font-medium">
                {t("summary.metricColumn")}
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                {t("summary.portfolioColumn")}
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                {t("summary.benchmarkColumn", { symbol: benchmarkSymbol })}
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => {
              const label = t(`metric.${row.metric}.label`)
              const unavailable = row.portfolio === null

              return (
                <tr key={row.metric} className="border-b last:border-b-0">
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    <span className="inline-flex items-center gap-1.5">
                      {label}
                      <Tooltip>
                        <TooltipTrigger
                          type="button"
                          aria-label={t("summary.explain", { metric: label })}
                          className="rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Info aria-hidden className="size-3.5" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-pretty">
                          {t(`metric.${row.metric}.hint`)}
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  </th>

                  <td className="px-4 py-2 text-right tabular-nums">
                    <span data-testid={`portfolio-${row.metric}`} className="font-medium">
                      {show(row, "portfolio")}
                    </span>
                    {row.portfolioYear ? (
                      <span className="ml-1 text-xs text-muted-foreground">({row.portfolioYear})</span>
                    ) : null}
                    {unavailable && row.unavailableReason ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {t(row.unavailableReason)}
                      </span>
                    ) : null}
                    {row.comparison && row.comparison !== "equal" ? (
                      <span className="block text-xs text-muted-foreground">
                        <span aria-hidden>{row.comparison === "better" ? "▲ " : "▼ "}</span>
                        {t(`summary.${row.comparison}`)}
                      </span>
                    ) : null}
                  </td>

                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    <span data-testid={`benchmark-${row.metric}`}>{show(row, "benchmark")}</span>
                    {row.benchmarkYear ? (
                      <span className="ml-1 text-xs">({row.benchmarkYear})</span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
