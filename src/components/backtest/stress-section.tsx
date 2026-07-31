"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { STRESS_EARLIEST_YEAR } from "@/engine"
import { formatPercent } from "@/lib/backtest/format"
import type { StressRow } from "@/lib/backtest/phase4-data"
import { useLanguage } from "@/i18n"
import { parseYearMonth } from "@/types/series"

type Props = {
  rows: StressRow[]
  portfolioNames: string[]
  benchmarkSymbol: string
}

/**
 * พอร์ตนี้ผ่านวิกฤตอะไรมาแล้วบ้าง (US-32)
 *
 * **คำอธิบายใต้ชื่อเหตุการณ์เป็นของบังคับ ไม่ใช่ของเสริม** (BR-RSK-47) — เกณฑ์ปิด S19
 * คือตารางนี้ต้องอ่านรู้เรื่องโดยไม่ต้องมีความรู้การเงิน · ช่วงวันที่อย่างเดียวไม่พอ
 */
export function StressSection({ rows, portfolioNames, benchmarkSymbol }: Props) {
  const { t } = useLanguage()

  /**
   * ใช้ชื่อเดือนย่อกับปีคริสต์ศักราช **ให้ตรงกับทุกวันที่อื่นบนหน้าเดียวกัน**
   * (ตารางช่วงขาดทุน · กราฟ · ตารางรายเดือน ใช้ปีคริสต์ศักราชทั้งหมด)
   * wireframe ในการ์ดร่างไว้เป็นปีพุทธศักราช แต่จะกลายเป็นวันที่สองระบบบนจอเดียว
   */
  const monthLabel = (month: string) => {
    const { year, month: m } = parseYearMonth(month)
    return `${t(`monthsShort.${m}`)} ${year}`
  }

  const range = (row: StressRow) =>
    row.start === row.end
      ? monthLabel(row.start)
      : `${monthLabel(row.start)} – ${monthLabel(row.end)}`

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1">
        <h2 className="font-heading text-base leading-snug font-medium">{t("stress.heading")}</h2>
        <p className="text-sm text-pretty text-muted-foreground">{t("stress.intro")}</p>
        {/* บอกว่าดูย้อนได้ถึงปีไหน วิกฤตที่เก่ากว่านั้นไม่อยู่ในตาราง (BR-RSK-48) */}
        <p className="text-xs text-pretty text-muted-foreground">
          {t("stress.coverageNote", { year: STRESS_EARLIEST_YEAR })}
        </p>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm" data-testid="stress-table">
            <caption className="sr-only">{t("stress.caption")}</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-medium">
                  {t("stress.eventColumn")}
                </th>
                <th scope="col" className="py-1 pr-3 font-medium">
                  {t("stress.rangeColumn")}
                </th>
                {portfolioNames.map((name, index) => (
                  <th key={index} scope="col" className="py-1 pr-3 text-right font-medium">
                    {name}
                  </th>
                ))}
                <th scope="col" className="py-1 text-right font-medium">
                  {t("summary.benchmarkColumn", { symbol: benchmarkSymbol })}
                </th>
              </tr>
            </thead>
            <tbody data-testid="stress-rows">
              {rows.map((row) => (
                <tr key={row.key} className="border-b last:border-0 align-top">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    {t(`stress.events.${row.key}.name`)}
                    {/* สิ่งที่ทำให้ตารางนี้อ่านได้โดยไม่ต้องรู้การเงิน (BR-RSK-47) */}
                    <span className="block text-xs text-pretty text-muted-foreground">
                      {t(`stress.events.${row.key}.what`)}
                    </span>
                  </th>
                  <td className="py-1.5 pr-3 text-muted-foreground">{range(row)}</td>
                  {row.portfolios.map((value, index) => (
                    <td
                      key={index}
                      className="py-1.5 pr-3 text-right tabular-nums"
                      data-testid={
                        portfolioNames.length === 1
                          ? `stress-${row.key}`
                          : `stress${index}-${row.key}`
                      }
                    >
                      {formatPercent(value)}
                      {value === null ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {t("stress.notCovered")}
                        </span>
                      ) : null}
                    </td>
                  ))}
                  <td
                    className="py-1.5 text-right tabular-nums text-muted-foreground"
                    data-testid={`stress-benchmark-${row.key}`}
                  >
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
