"use client"

import { Info } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { barOpacity } from "@/components/backtest/series-style"
import { ChartLegend, portfolioBar } from "@/components/backtest/chart-legend"
import { formatPercent, formatPercentAxis, NO_VALUE } from "@/lib/backtest/format"
import type { RollingData } from "@/lib/backtest/rolling-data"
import { useLanguage } from "@/i18n"

type Props = {
  data: RollingData
  /** ชื่อพอร์ตที่แสดงแล้ว เรียงตามลำดับพอร์ต (BR-CMP-27) */
  portfolioNames: string[]
}

const MONTHS_PER_YEAR = 12

/**
 * ผลตอบแทนแบบหน้าต่างเลื่อน (US-20)
 *
 * ตารางเป็นของบังคับ กราฟเป็นของเสริมที่มีตารางเทียบเท่ากำกับอยู่แล้ว (BR-CMP-71, BR-CMP-29)
 * ค่าทุกตัวมาจากชั้นคำนวณ — ส่วนนี้ไม่หาค่าเฉลี่ยหรือนับสัดส่วนเอง
 */
export function RollingSection({ data, portfolioNames }: Props) {
  const { t } = useLanguage()
  const years = (months: number) => t("rolling.windowYears", { count: months / MONTHS_PER_YEAR })

  /** จุดของกราฟ หนึ่งจุดต่อหน้าต่างที่มีค่า — คีย์แบนเพราะไลบรารีกราฟไม่รับอาร์เรย์ */
  const points = data.rows
    .filter((row) => row.portfolios.some((stats) => stats.count > 0))
    .map((row) => {
      const point: Record<string, unknown> = { window: years(row.windowMonths) }
      row.portfolios.forEach((stats, index) => {
        // แท่งลอยจากต่ำสุดถึงสูงสุด — ไลบรารีกราฟรับคู่ค่าเป็นช่วงได้เอง
        point[`range${index}`] = stats.min !== null && stats.max !== null ? [stats.min, stats.max] : null
        point[`avg${index}`] = stats.average
      })
      return point
    })

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1">
        <h2 className="font-heading text-base leading-snug font-medium">{t("rolling.heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("rolling.intro")}</p>
        {/* ค่าชุดนี้ไม่ขึ้นกับเงินเข้าออกและไม่ถูกปรับเงินเฟ้อ ต้องบอกไว้ (BR-CMP-70) */}
        <p
          className="text-xs text-pretty text-muted-foreground"
          data-testid="rolling-pure-note"
        >
          {t("rolling.pureNote")}
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {points.length > 0 ? (
          <div className="h-56 w-full" data-testid="rolling-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={points} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="window"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  stroke="currentColor"
                />
                <YAxis
                  tickFormatter={(value: number) => formatPercentAxis(value)}
                  tick={{ fontSize: 12 }}
                  width={52}
                  className="fill-muted-foreground"
                  stroke="currentColor"
                />
                {/* เส้นศูนย์ทำให้เห็นทันทีว่าช่วงไหนกินลงไปใต้ทุน */}
                <ReferenceLine y={0} className="stroke-border" strokeWidth={1} />
                <ChartTooltip
                  cursor={false}
                  formatter={(value) =>
                    Array.isArray(value)
                      ? `${formatPercent(value[0] as number)} … ${formatPercent(value[1] as number)}`
                      : formatPercent(typeof value === "number" ? value : null)
                  }
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
                    dataKey={`range${index}`}
                    name={name}
                    fill="var(--primary)"
                    fillOpacity={barOpacity(index)}
                    stroke="var(--primary)"
                    isAnimationActive={false}
                    shape={<RangeBar averageKey={`avg${index}`} />}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        {/* ส่วนนี้ไม่วาดตัวเทียบ ป้ายจึงมีแค่พอร์ต (BR-CMP-70, AC-LOOP-07) */}
        {points.length > 0 ? (
          <ChartLegend
            items={portfolioNames.map((name, index) => portfolioBar(name, index))}
            testId="rolling-legend"
          />
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">{t("rolling.chartCaption")}</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-medium">
                  {t("rolling.holdColumn")}
                </th>
                <th scope="col" className="py-1 pr-3 font-medium">
                  {t("rolling.portfolioColumn")}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {t("rolling.lowColumn")}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    {t("rolling.averageColumn")}
                    <Explain metric="rollingAverage" />
                  </span>
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {t("rolling.highColumn")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    {t("rolling.positiveColumn")}
                    <Explain metric="positiveWindowShare" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody data-testid="rolling-table">
              {data.rows.flatMap((row) =>
                row.portfolios.map((stats, index) => {
                  const cellId = (part: string) =>
                    portfolioNames.length === 1
                      ? `rolling-${part}-${row.windowMonths}`
                      : `rolling${index}-${part}-${row.windowMonths}`
                  return (
                    <tr key={`${row.windowMonths}-${index}`} className="border-b last:border-0">
                      {/* ระยะถือกำกับแถวแรกของกลุ่ม แต่ยังผูกกับทุกแถวผ่าน rowSpan */}
                      {index === 0 ? (
                        <th
                          scope="rowgroup"
                          rowSpan={row.portfolios.length}
                          className="py-1 pr-3 text-left align-top font-normal tabular-nums"
                        >
                          {years(row.windowMonths)}
                          {stats.count > 0 ? (
                            <span className="block text-xs text-muted-foreground">
                              {t("rolling.windowCount", { count: stats.count })}
                            </span>
                          ) : null}
                        </th>
                      ) : null}
                      <th scope="row" className="py-1 pr-3 text-left font-normal">
                        {portfolioNames[index]}
                      </th>
                      <td className="py-1 pr-3 text-right tabular-nums" data-testid={cellId("low")}>
                        {show(stats.min)}
                      </td>
                      <td
                        className="py-1 pr-3 text-right tabular-nums"
                        data-testid={cellId("average")}
                      >
                        {show(stats.average)}
                      </td>
                      <td className="py-1 pr-3 text-right tabular-nums" data-testid={cellId("high")}>
                        {show(stats.max)}
                      </td>
                      <td className="py-1 text-right tabular-nums" data-testid={cellId("positive")}>
                        {show(stats.positiveShare)}
                      </td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>
        </div>

        {/* หน้าต่างที่ยาวเกินยังอยู่ในตารางเป็นขีด พร้อมบอกเหตุผล ไม่ซ่อนแถวทิ้ง (BR-CMP-69) */}
        {data.unavailableWindows.map((windowMonths) => (
          <p
            key={windowMonths}
            className="text-sm text-muted-foreground"
            role="status"
            data-testid={`rolling-unavailable-${windowMonths}`}
          >
            {t("notice.rollingWindowTooLong", { window: years(windowMonths) })}
          </p>
        ))}

        <p className="text-xs text-pretty text-muted-foreground">{t("rolling.averageWarning")}</p>
        <p className="sr-only">{t("rolling.chartAlt")}</p>
      </CardContent>
    </Card>
  )
}

function show(value: number | null): string {
  return value === null ? NO_VALUE : formatPercent(value)
}

function Explain({ metric }: { metric: string }) {
  const { t } = useLanguage()
  const label = t(`metric.${metric}.label`)
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={t("summary.explain", { metric: label })}
        className="rounded-full text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info aria-hidden className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty">{t(`metric.${metric}.hint`)}</TooltipContent>
    </Tooltip>
  )
}

/**
 * แท่งช่วงต่ำสุด–สูงสุด พร้อมขีดค่าเฉลี่ยพาดกลาง
 *
 * ไลบรารีกราฟส่งกรอบของแท่ง (x, y, width, height) กับค่าดิบของจุดนั้นมาให้แล้ว
 * ตำแหน่งของขีดจึงหาได้จากสัดส่วนภายในกรอบ โดยไม่ต้องเข้าถึงสเกลของแกน
 */
type RangeBarProps = {
  averageKey?: string
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  fillOpacity?: number
  stroke?: string
  payload?: Record<string, unknown>
}

function RangeBar({
  averageKey,
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill,
  fillOpacity,
  stroke,
  payload,
}: RangeBarProps) {
  const range = averageKey ? payload?.[averageKey.replace("avg", "range")] : undefined
  const average = averageKey ? payload?.[averageKey] : undefined

  let averageY: number | null = null
  if (Array.isArray(range) && typeof average === "number" && height > 0) {
    const [low, high] = range as [number, number]
    // แกนค่าชี้ขึ้น แต่แกนภาพชี้ลง สัดส่วนจึงวัดจากค่าสูงสุดลงมา
    if (high > low) averageY = y + (height * (high - average)) / (high - low)
  }

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 1)}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke}
        strokeWidth={1}
        rx={2}
      />
      {averageY === null ? null : (
        <line x1={x} x2={x + width} y1={averageY} y2={averageY} stroke={stroke} strokeWidth={2} />
      )}
    </g>
  )
}
