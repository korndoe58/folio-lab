"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { seriesKey, type AnnualData } from "@/lib/backtest/chart-data"
import { barOpacity } from "@/components/backtest/series-style"
import { formatPercent, formatPercentAxis } from "@/lib/backtest/format"
import { useLanguage } from "@/i18n"

type Props = {
  data: AnnualData
  benchmarkSymbol: string
  /** ชื่อพอร์ตที่แสดงแล้ว เรียงตามลำดับพอร์ต (BR-CMP-27) */
  portfolioNames: string[]
  /** ค่าในส่วนนี้หักเงินเฟ้อแล้ว — ต้องกำกับให้เห็น ไม่ใช่เปลี่ยนตัวเลขเงียบ ๆ (BR-INF-10) */
  inflationAdjusted?: boolean
}

/**
 * ผลตอบแทนรายปีเทียบตัวเทียบ (US-09)
 * แท่งพอร์ต = ทึบ · แท่งตัวเทียบ = โปร่งมีขอบ — แยกกันได้โดยไม่ต้องพึ่งสี
 * ตารางแสดงคู่กับกราฟเสมอตาม BR-ANN-02 จึงทำหน้าที่เป็นข้อมูลเทียบเท่าไปในตัว
 */
export function AnnualSection({
  data,
  benchmarkSymbol,
  portfolioNames,
  inflationAdjusted = false,
}: Props) {
  const { t } = useLanguage()
  const benchmarkLabel = t("summary.benchmarkColumn", { symbol: benchmarkSymbol })

  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-base leading-snug font-medium">
          {inflationAdjusted ? t("chart.annualHeadingReal") : t("chart.annualHeading")}
        </h2>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="h-56 w-full" data-testid="annual-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.rows} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
                minTickGap={12}
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
              {/* เส้นศูนย์ต้องเห็นชัด เพราะเป็นเส้นแบ่งกำไรกับขาดทุน (BR-ANN-06) */}
              <ReferenceLine y={0} className="stroke-foreground" strokeWidth={1} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                formatter={(value) => formatPercent(typeof value === "number" ? value : null)}
                contentStyle={{
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  fontSize: "0.8rem",
                }}
              />
              {portfolioNames.map((name, index) => (
                <Bar
                  key={index}
                  dataKey={seriesKey(index)}
                  name={name}
                  fill="var(--primary)"
                  fillOpacity={barOpacity(index)}
                  stroke="var(--primary)"
                  strokeWidth={index === 0 ? 0 : 1}
                  isAnimationActive={false}
                />
              ))}
              <Bar
                dataKey="benchmark"
                name={benchmarkLabel}
                fill="transparent"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] text-sm">
            <caption className="sr-only">
              {inflationAdjusted ? t("chart.annualHeadingReal") : t("chart.annualHeading")}
            </caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-medium">
                  {t("chart.yearColumn")}
                </th>
                {portfolioNames.map((name, index) => (
                  <th key={index} scope="col" className="py-1 pr-3 text-right font-medium">
                    {name}
                  </th>
                ))}
                <th scope="col" className="py-1 text-right font-medium">
                  {benchmarkLabel}
                </th>
              </tr>
            </thead>
            <tbody data-testid="annual-table">
              {data.rows.map((row) => (
                <tr key={row.year} className="border-b last:border-0">
                  <th scope="row" className="py-1 pr-3 text-left font-normal tabular-nums">
                    {row.year}
                    {row.months[0] ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t("chart.partialYear", { count: row.months[0] })}
                      </span>
                    ) : null}
                  </th>
                  {row.values.map((value, index) => (
                    <td
                      key={index}
                      className="py-1 pr-3 text-right tabular-nums"
                      data-testid={
                        portfolioNames.length === 1
                          ? `annual-${row.year}`
                          : `annual${index}-${row.year}`
                      }
                    >
                      {formatPercent(value)}
                    </td>
                  ))}
                  <td className="py-1 text-right tabular-nums text-muted-foreground">
                    {formatPercent(row.benchmark)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
