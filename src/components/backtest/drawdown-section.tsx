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
import { seriesKey, type DrawdownData } from "@/lib/backtest/chart-data"
import { BENCHMARK_DASH, lineDash, lineWidth } from "@/components/backtest/series-style"
import { ChartLegend, benchmarkLine, portfolioLine } from "@/components/backtest/chart-legend"
import { formatDuration, formatPercent, formatPercentAxis } from "@/lib/backtest/format"
import { useLanguage } from "@/i18n"
import { parseYearMonth } from "@/types/series"

type Props = {
  data: DrawdownData
  benchmarkSymbol: string
  /** ชื่อพอร์ตที่แสดงแล้ว เรียงตามลำดับพอร์ต (BR-CMP-27) */
  portfolioNames: string[]
}

/**
 * ช่วงขาดทุนและเวลาฟื้น (US-10)
 * ค่าทุกตัวมาจากชั้นคำนวณ — หน้าจอไม่หาจุดต่ำสุดหรือคำนวณเวลาฟื้นเอง (BR-DDW-08)
 * ตาราง 5 อันดับทำหน้าที่เป็นข้อมูลเทียบเท่าของภาพไปในตัว (BR-DDW-09)
 */
export function DrawdownSection({ data, benchmarkSymbol, portfolioNames }: Props) {
  const { t } = useLanguage()
  const benchmarkLabel = t("summary.benchmarkColumn", { symbol: benchmarkSymbol })
  const single = portfolioNames.length === 1
  const anyDrawdown = data.perPortfolio.some((p) => p.worst.length > 0)

  const monthLabel = (month: string) => {
    const { year, month: m } = parseYearMonth(month)
    return `${t(`months.${m}`)} ${year}`
  }

  const duration = (months: number) =>
    formatDuration(months, {
      year: (n) => t("drawdown.years", { count: n }),
      month: (n) => t("drawdown.months", { count: n }),
    })

  const legendItems = [
    ...portfolioNames.map((name, index) => portfolioLine(name, index)),
    benchmarkLine(benchmarkLabel),
  ]

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base leading-snug font-medium">{t("drawdown.heading")}</h2>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {!anyDrawdown ? (
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
                  {/* พอร์ตแรก = พื้นที่ทึบ · พอร์ตถัดไปและตลาด = เส้นลายต่างกัน (BR-DDW-05, BR-CMP-28) */}
                  <Area
                    type="monotone"
                    dataKey={seriesKey(0)}
                    name={portfolioNames[0]}
                    stroke="var(--primary)"
                    fill="var(--primary)"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  {portfolioNames.slice(1).map((name, i) => (
                    <Line
                      key={i}
                      type="monotone"
                      dataKey={seriesKey(i + 1)}
                      name={name}
                      stroke="var(--primary)"
                      strokeWidth={lineWidth(i + 1)}
                      strokeDasharray={lineDash(i + 1)}
                      dot={false}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="benchmark"
                    name={benchmarkLabel}
                    stroke="var(--muted-foreground)"
                    strokeWidth={1.5}
                    strokeDasharray={BENCHMARK_DASH}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ป้ายอยู่นอกกรอบกราฟ เพื่อไม่ให้ตัวนับที่ผูกกับกรอบนั้นเปลี่ยนความหมาย (US-34) */}
            <ChartLegend items={legendItems} testId="drawdown-legend" />

            {/* หนึ่งตารางต่อพอร์ต เพราะช่วงขาดทุนของแต่ละพอร์ตไม่ตรงกัน รวมเป็นแถวเดียวกันไม่ได้ (BR-CMP-30) */}
            {data.perPortfolio.map((portfolio, pIndex) => (
              <section key={pIndex} className="flex flex-col gap-2">
                {single ? null : (
                  <h3 className="text-sm font-medium">
                    {t("drawdown.headingFor", { name: portfolioNames[pIndex] })}
                  </h3>
                )}

                <p
                  className="text-sm text-muted-foreground"
                  data-testid={single ? "drawdown-count" : `drawdown${pIndex}-count`}
                >
                  {portfolio.totalPeriods > portfolio.worst.length
                    ? t("drawdown.found", {
                        count: portfolio.totalPeriods,
                        shown: portfolio.worst.length,
                      })
                    : t("drawdown.foundFew", { count: portfolio.totalPeriods })}
                </p>

                {portfolio.worst.length === 0 ? (
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid={single ? "drawdown-none" : `drawdown${pIndex}-none`}
                  >
                    {t("drawdown.none")}
                  </p>
                ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <caption className="sr-only">
                  {single
                    ? t("drawdown.chartCaption")
                    : t("drawdown.headingFor", { name: portfolioNames[pIndex] })}
                </caption>
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
                <tbody data-testid={single ? "drawdown-table" : `drawdown${pIndex}-table`}>
                  {portfolio.worst.map((period, index) => {
                    const cellId = (part: string) =>
                      single
                        ? `drawdown-${part}-${index + 1}`
                        : `drawdown${pIndex}-${part}-${index + 1}`
                    return (
                    <tr key={period.start} className="border-b last:border-0">
                      <th
                        scope="row"
                        className="py-1 pr-3 text-left font-normal tabular-nums"
                        data-testid={cellId("rank")}
                      >
                        {index + 1}
                      </th>
                      <td className="py-1 pr-3">{monthLabel(period.start)}</td>
                      <td className="py-1 pr-3">{monthLabel(period.trough)}</td>
                      <td
                        className="py-1 pr-3 text-right tabular-nums"
                        data-testid={cellId("depth")}
                      >
                        {formatPercent(period.depth)}
                      </td>
                      <td className="py-1 pr-3" data-testid={cellId("recovered")}>
                        {period.recoveredAt === null
                          ? t("drawdown.notRecovered")
                          : monthLabel(period.recoveredAt)}
                      </td>
                      <td className="py-1 tabular-nums" data-testid={cellId("duration")}>
                        {period.recoveryMonths === null
                          ? t("drawdown.notRecovered")
                          : duration(period.recoveryMonths)}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
                )}
              </section>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
