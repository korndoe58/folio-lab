"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { DrawdownData } from "@/lib/backtest/chart-data"
import { formatDuration, formatPercent, formatPercentAxis } from "@/lib/backtest/format"
import { useLanguage } from "@/i18n"
import { parseYearMonth } from "@/types/series"

type Props = {
  data: DrawdownData
  benchmarkSymbol: string
}

/**
 * ช่วงขาดทุนและเวลาฟื้น (US-10)
 * ค่าทุกตัวมาจากชั้นคำนวณ — หน้าจอไม่หาจุดต่ำสุดหรือคำนวณเวลาฟื้นเอง (BR-DDW-08)
 * ตาราง 5 อันดับทำหน้าที่เป็นข้อมูลเทียบเท่าของภาพไปในตัว (BR-DDW-09)
 */
export function DrawdownSection({ data, benchmarkSymbol }: Props) {
  const { t } = useLanguage()
  const benchmarkLabel = t("summary.benchmarkColumn", { symbol: benchmarkSymbol })

  const monthLabel = (month: string) => {
    const { year, month: m } = parseYearMonth(month)
    return `${t(`months.${m}`)} ${year}`
  }

  const duration = (months: number) =>
    formatDuration(months, {
      year: (n) => t("drawdown.years", { count: n }),
      month: (n) => t("drawdown.months", { count: n }),
    })

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base leading-snug font-medium">{t("drawdown.heading")}</h2>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {data.worst.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="drawdown-none">
            {t("drawdown.none")}
          </p>
        ) : (
          <>
            <div className="h-48 w-full" data-testid="drawdown-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.points} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="month"
                    ticks={data.yearTicks}
                    tickFormatter={(month: string) => String(parseYearMonth(month).year)}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    stroke="currentColor"
                  />
                  <YAxis
                    tickFormatter={(value: number) => formatPercentAxis(value)}
                    tick={{ fontSize: 12 }}
                    width={48}
                    className="fill-muted-foreground"
                    stroke="currentColor"
                  />
                  <Tooltip
                    labelFormatter={(month) => monthLabel(month as string)}
                    formatter={(value) => formatPercent(typeof value === "number" ? value : null)}
                    contentStyle={{
                      background: "var(--popover)",
                      color: "var(--popover-foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.5rem",
                      fontSize: "0.8rem",
                    }}
                  />
                  {/* พอร์ต = พื้นที่ทึบ · ตลาด = เส้นประ แยกกันได้โดยไม่พึ่งสี (BR-DDW-05) */}
                  <Area
                    type="monotone"
                    dataKey="portfolio"
                    name={t("summary.portfolioColumn")}
                    stroke="var(--primary)"
                    fill="var(--primary)"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmark"
                    name={benchmarkLabel}
                    stroke="var(--muted-foreground)"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <p className="text-sm text-muted-foreground" data-testid="drawdown-count">
              {data.totalPeriods > data.worst.length
                ? t("drawdown.found", { count: data.totalPeriods, shown: data.worst.length })
                : t("drawdown.foundFew", { count: data.totalPeriods })}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <caption className="sr-only">{t("drawdown.chartCaption")}</caption>
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("drawdown.rank")}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("drawdown.start")}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("drawdown.trough")}
                    </th>
                    <th scope="col" className="py-1 pr-3 text-right font-medium">
                      {t("drawdown.depth")}
                    </th>
                    <th scope="col" className="py-1 pr-3 font-medium">
                      {t("drawdown.recovered")}
                    </th>
                    <th scope="col" className="py-1 font-medium">
                      {t("drawdown.duration")}
                    </th>
                  </tr>
                </thead>
                <tbody data-testid="drawdown-table">
                  {data.worst.map((period, index) => (
                    <tr key={period.start} className="border-b last:border-0">
                      <th
                        scope="row"
                        className="py-1 pr-3 text-left font-normal tabular-nums"
                        data-testid={`drawdown-rank-${index + 1}`}
                      >
                        {index + 1}
                      </th>
                      <td className="py-1 pr-3">{monthLabel(period.start)}</td>
                      <td className="py-1 pr-3">{monthLabel(period.trough)}</td>
                      <td
                        className="py-1 pr-3 text-right tabular-nums"
                        data-testid={`drawdown-depth-${index + 1}`}
                      >
                        {formatPercent(period.depth)}
                      </td>
                      <td
                        className="py-1 pr-3"
                        data-testid={`drawdown-recovered-${index + 1}`}
                      >
                        {period.recoveredAt === null
                          ? t("drawdown.notRecovered")
                          : monthLabel(period.recoveredAt)}
                      </td>
                      <td
                        className="py-1 tabular-nums"
                        data-testid={`drawdown-duration-${index + 1}`}
                      >
                        {period.recoveryMonths === null
                          ? t("drawdown.notRecovered")
                          : duration(period.recoveryMonths)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
