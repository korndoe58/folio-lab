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
import { contributionKey, seriesKey, type GrowthData } from "@/lib/backtest/chart-data"
import {
  BENCHMARK_DASH,
  CONTRIBUTION_DASH,
  lineDash,
  lineWidth,
} from "@/components/backtest/series-style"
import {
  ChartLegend,
  benchmarkLine,
  contributionLine,
  portfolioLine,
} from "@/components/backtest/chart-legend"
import { formatMoney } from "@/lib/backtest/format"
import type { Currency } from "@/data/currency"
import { useLanguage } from "@/i18n"
import { parseYearMonth } from "@/types/series"

type Props = {
  data: GrowthData
  benchmarkSymbol: string
  currency: Currency
  /** ชื่อพอร์ตที่แสดงแล้ว เรียงตามลำดับพอร์ต (BR-CMP-27) */
  portfolioNames: string[]
  /** เส้นนี้ไม่ถูกปรับเงินเฟ้อเพราะดัชนีมีแค่รายปี — ต้องบอกผู้ใช้เมื่อเปิดตัวเลือก (BR-INF-07) */
  inflationAdjusted?: boolean
}

/**
 * เส้นมูลค่าพอร์ตเทียบตัวเทียบ (US-08)
 * พอร์ต = เส้นทึบ · ตัวเทียบ = เส้นประ — แยกกันได้โดยไม่ต้องพึ่งสี (BR-GRW-06)
 */
export function GrowthChart({
  data,
  benchmarkSymbol,
  currency,
  portfolioNames,
  inflationAdjusted = false,
}: Props) {
  const { t } = useLanguage()
  const [logScale, setLogScale] = useState(false)

  const monthLabel = (month: string | null) => {
    if (month === null) return t("chart.startPoint")
    const { year, month: m } = parseYearMonth(month)
    return `${t(`months.${m}`)} ${year}`
  }

  const values = data.points.flatMap((p) =>
    [...p.values, p.benchmark].filter((v): v is number => v !== null),
  )

  /** พอร์ตที่มีเส้นเงินที่ใส่สะสม — พอร์ตที่ไม่มีเงินเข้าออกได้ null ทุกจุด */
  const withContributions = portfolioNames.map((_, index) =>
    data.points.some((point) => point.contributions[index] !== null),
  )
  const domain = logScale
    ? ([Math.min(...values) * 0.9, Math.max(...values) * 1.1] as const)
    : (["auto", "auto"] as const)

  const contributionLabel = (name: string) =>
    portfolioNames.length === 1 ? t("chart.contributed") : t("chart.contributedOf", { name })

  /** ป้ายมีเฉพาะชุดที่วาดอยู่จริงในกราฟนี้ (BR-LOOP-10) */
  const legendItems = [
    ...portfolioNames.map((name, index) => portfolioLine(name, index)),
    ...portfolioNames
      .filter((_, index) => withContributions[index])
      .map((name) => contributionLine(contributionLabel(name))),
    benchmarkLine(t("summary.benchmarkColumn", { symbol: benchmarkSymbol })),
  ]

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
        {inflationAdjusted ? (
          <p className="text-xs text-pretty text-muted-foreground">{t("chart.nominalNote")}</p>
        ) : null}

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
              {portfolioNames.map((name, index) => (
                <Line
                  key={index}
                  type="monotone"
                  dataKey={seriesKey(index)}
                  name={name}
                  stroke="var(--primary)"
                  strokeWidth={lineWidth(index)}
                  strokeDasharray={lineDash(index)}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
              {/* เส้นเงินที่ใส่สะสม โผล่เฉพาะพอร์ตที่ตั้งเงินเข้าออกไว้จริง (AC-CMP-31) */}
              {portfolioNames.map((name, index) =>
                withContributions[index] ? (
                  <Line
                    key={`c${index}`}
                    type="monotone"
                    dataKey={contributionKey(index)}
                    name={contributionLabel(name)}
                    stroke="var(--muted-foreground)"
                    strokeWidth={1.5}
                    strokeDasharray={CONTRIBUTION_DASH}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                ) : null,
              )}
              <Line
                type="monotone"
                dataKey="benchmark"
                name={t("summary.benchmarkColumn", { symbol: benchmarkSymbol })}
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray={BENCHMARK_DASH}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ป้ายอยู่นอกกรอบกราฟ เพื่อไม่ให้ตัวนับที่ผูกกับกรอบนั้นเปลี่ยนความหมาย (US-34) */}
        <ChartLegend items={legendItems} testId="growth-legend" />

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
                  {portfolioNames.map((name, index) => (
                    <th key={index} scope="col" className="py-1 pr-3 text-right font-medium">
                      {name}
                    </th>
                  ))}
                  {/* คอลัมน์เงินที่ใส่สะสม โผล่เฉพาะพอร์ตที่มีเงินเข้าออก (AC-CMP-31) */}
                  {portfolioNames.map((name, index) =>
                    withContributions[index] ? (
                      <th key={`c${index}`} scope="col" className="py-1 pr-3 text-right font-medium">
                        {contributionLabel(name)}
                      </th>
                    ) : null,
                  )}
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
                    {row.values.map((value, index) => (
                      <td
                        key={index}
                        className="py-1 pr-3 text-right tabular-nums"
                        data-testid={
                          portfolioNames.length === 1
                            ? `year-end-${row.year}`
                            : `year-end${index}-${row.year}`
                        }
                      >
                        {formatMoney(value, currency)}
                      </td>
                    ))}
                    {row.contributions.map((value, index) =>
                      withContributions[index] ? (
                        <td
                          key={`c${index}`}
                          className="py-1 pr-3 text-right tabular-nums text-muted-foreground"
                          data-testid={
                            portfolioNames.length === 1
                              ? `contributed-${row.year}`
                              : `contributed${index}-${row.year}`
                          }
                        >
                          {formatMoney(value, currency)}
                        </td>
                      ) : null,
                    )}
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
