"use client"

import { useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { GrowthData } from "@/lib/backtest/chart-data"
import { formatMoney } from "@/lib/backtest/format"
import type { Currency } from "@/data/currency"
import { useLanguage } from "@/i18n"
import { parseYearMonth } from "@/types/series"

type Props = {
  data: GrowthData
  benchmarkSymbol: string
  currency: Currency
}

/**
 * เส้นมูลค่าพอร์ตเทียบตัวเทียบ (US-08)
 * พอร์ต = เส้นทึบ · ตัวเทียบ = เส้นประ — แยกกันได้โดยไม่ต้องพึ่งสี (BR-GRW-06)
 */
export function GrowthChart({ data, benchmarkSymbol, currency }: Props) {
  const { t } = useLanguage()
  const [logScale, setLogScale] = useState(false)

  const monthLabel = (month: string | null) => {
    if (month === null) return t("chart.startPoint")
    const { year, month: m } = parseYearMonth(month)
    return `${t(`months.${m}`)} ${year}`
  }

  const values = data.points.flatMap((p) =>
    p.benchmark === null ? [p.portfolio] : [p.portfolio, p.benchmark],
  )
  const domain = logScale
    ? ([Math.min(...values) * 0.9, Math.max(...values) * 1.1] as const)
    : (["auto", "auto"] as const)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base leading-snug font-medium">
          {t("chart.growthHeading")}
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={logScale}
          disabled={data.logDisabled}
          title={data.logDisabled ? t("chart.logDisabledHint") : t("chart.scaleLabel")}
          onClick={() => setLogScale((prev) => !prev)}
        >
          {logScale ? t("chart.scaleLog") : t("chart.scaleLinear")}
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="h-64 w-full" data-testid="growth-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.points} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="month"
                ticks={data.yearTicks}
                tickFormatter={(month: string | null) =>
                  month === null ? "" : String(parseYearMonth(month).year)
                }
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
                stroke="currentColor"
              />
              <YAxis
                scale={logScale ? "log" : "linear"}
                domain={domain as [number | string, number | string]}
                allowDataOverflow={logScale}
                tickFormatter={(value: number) => formatMoney(value, currency)}
                tick={{ fontSize: 12 }}
                width={72}
                className="fill-muted-foreground"
                stroke="currentColor"
              />
              <Tooltip
                labelFormatter={(month) => monthLabel(month as string | null)}
                formatter={(value) => formatMoney(typeof value === "number" ? value : null, currency)}
                contentStyle={{
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  fontSize: "0.8rem",
                }}
              />
              <Line
                type="monotone"
                dataKey="portfolio"
                name={t("summary.portfolioColumn")}
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                name={t("summary.benchmarkColumn", { symbol: benchmarkSymbol })}
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="sr-only">{t("chart.chartAlt")}</p>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            {t("chart.viewAsTable")}
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[20rem] text-sm">
              <caption className="sr-only">{t("chart.yearEndCaption")}</caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("chart.yearColumn")}
                  </th>
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("chart.monthColumn")}
                  </th>
                  <th scope="col" className="py-1 pr-3 text-right font-medium">
                    {t("summary.portfolioColumn")}
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    {t("summary.benchmarkColumn", { symbol: benchmarkSymbol })}
                  </th>
                </tr>
              </thead>
              <tbody data-testid="growth-year-end">
                {data.yearEnd.map((row) => (
                  <tr key={row.year} className="border-b last:border-0">
                    <th scope="row" className="py-1 pr-3 text-left font-normal tabular-nums">
                      {row.year}
                    </th>
                    <td className="py-1 pr-3 text-muted-foreground">{monthLabel(row.month)}</td>
                    <td
                      className="py-1 pr-3 text-right tabular-nums"
                      data-testid={`year-end-${row.year}`}
                    >
                      {formatMoney(row.portfolio, currency)}
                    </td>
                    <td className="py-1 text-right tabular-nums text-muted-foreground">
                      {formatMoney(row.benchmark, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
