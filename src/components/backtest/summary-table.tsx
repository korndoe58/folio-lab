"use client"

import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CopyLink } from "@/components/backtest/copy-link"
import { formatCount, formatMoney, formatPercent, formatRatio } from "@/lib/backtest/format"
import type { Currency } from "@/data/currency"
import type { Summary, SummaryRow } from "@/lib/backtest/summary"
import { useLanguage } from "@/i18n"
import { parseYearMonth, type MonthRange } from "@/types/series"

type Props = {
  summary: Summary
  range: MonthRange
  benchmarkSymbol: string
  currency: Currency
  /** ชื่อพอร์ตที่แสดงแล้ว เรียงตามลำดับพอร์ต (BR-CMP-27) */
  portfolioNames: string[]
}

export function SummaryTable({
  summary,
  range,
  benchmarkSymbol,
  currency,
  portfolioNames,
}: Props) {
  const { t } = useLanguage()

  const monthLabel = (month: string) => {
    const { year, month: m } = parseYearMonth(month)
    return `${t(`months.${m}`)} ${year}`
  }

  const show = (row: SummaryRow, value: number | null) => {
    if (row.format === "money") return formatMoney(value, currency)
    if (row.format === "percent") return formatPercent(value)
    if (row.format === "count") return formatCount(value)
    return formatRatio(value)
  }

  /** พอร์ตเดียวใช้ testid เดิม เพื่อให้จอและหลักฐานของการใช้งานปกติไม่เปลี่ยน (BR-CMP-31) */
  const cellId = (metric: string, index: number) =>
    portfolioNames.length === 1 ? `portfolio-${metric}` : `portfolio${index}-${metric}`

  return (
    <section className="flex flex-col gap-3" aria-labelledby="summary-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
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
        {/* ปรากฏเฉพาะเมื่อมีผลลัพธ์แสดงอยู่ ซึ่งคือตอนที่ตารางนี้ถูกวาด (BR-CMP-82) */}
        <CopyLink />
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
              {portfolioNames.map((name, index) => (
                <th key={index} scope="col" className="px-4 py-2 text-right font-medium">
                  {name}
                </th>
              ))}
              <th scope="col" className="px-4 py-2 text-right font-medium">
                {t("summary.benchmarkColumn", { symbol: benchmarkSymbol })}
              </th>
            </tr>
          </thead>
          <tbody data-testid="summary-rows">
            {summary.rows.map((row) => {
              const label = t(`metric.${row.metric}.label`)

              return (
                <tr key={row.metric} className="border-b last:border-b-0">
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    <span className="inline-flex items-center gap-1.5">
                      {label}
                      {/* กำกับด้วยข้อความ ไม่ใช่สีอย่างเดียว เพื่อให้อ่านออกทุกทาง (BR-INF-10) */}
                      {row.adjusted ? (
                        <span
                          data-testid={`adjusted-${row.metric}`}
                          className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground"
                        >
                          {t("summary.realMark")}
                        </span>
                      ) : null}
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

                  {row.portfolios.map((cell, index) => (
                    <td key={index} className="px-4 py-2 text-right tabular-nums">
                      <span data-testid={cellId(row.metric, index)} className="font-medium">
                        {show(row, cell.value)}
                      </span>
                      {cell.year ? (
                        <span className="ml-1 text-xs text-muted-foreground">({cell.year})</span>
                      ) : null}
                      {cell.value === null && cell.unavailableReason ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {t(cell.unavailableReason)}
                        </span>
                      ) : null}
                      {cell.comparison && cell.comparison !== "equal" ? (
                        <span className="block text-xs text-muted-foreground">
                          <span aria-hidden>{cell.comparison === "better" ? "▲ " : "▼ "}</span>
                          {t(`summary.${cell.comparison}`)}
                        </span>
                      ) : null}
                    </td>
                  ))}

                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    <span data-testid={`benchmark-${row.metric}`}>{show(row, row.benchmark)}</span>
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
