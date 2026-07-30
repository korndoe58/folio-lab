"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { MonthlyRow } from "@/lib/backtest/chart-data"
import { buildMonthlyCsv, csvFileName } from "@/lib/backtest/csv"
import { formatPercent, NO_VALUE } from "@/lib/backtest/format"
import type { Currency } from "@/data/currency"
import { useLanguage } from "@/i18n"
import { parseYearMonth, type MonthRange } from "@/types/series"

type Props = {
  rows: MonthlyRow[]
  /** ชื่อพอร์ตที่แสดงแล้ว เรียงตามลำดับพอร์ต (BR-CMP-27) */
  portfolioNames: string[]
  benchmarkSymbol: string
  range: MonthRange
  currency: Currency
  /** ผลชุดนี้เปิดตัวเลือกปรับเงินเฟ้อไว้หรือไม่ — ใส่ในบรรทัดหัวเรื่องของไฟล์ (BR-CMP-80) */
  inflationAdjusted: boolean
}

/**
 * ตารางผลตอบแทนรายเดือนและปุ่มบันทึกไฟล์ (US-21)
 *
 * พับไว้เป็นค่าเริ่มต้นเพราะช่วง 15 ปีมี 174 แถว ซึ่งยาวเกินกว่าจะแสดงตลอดเวลา
 * โดยไม่รบกวนส่วนอื่น (BR-CMP-73) · ปุ่มบันทึกไฟล์ยังกดได้แม้ตารางพับอยู่
 */
export function MonthlySection({
  rows,
  portfolioNames,
  benchmarkSymbol,
  range,
  currency,
  inflationAdjusted,
}: Props) {
  const { t } = useLanguage()

  const monthLabel = (month: string) => {
    const { year, month: m } = parseYearMonth(month)
    return `${t(`months.${m}`)} ${year}`
  }

  const handleSave = () => {
    const csv = buildMonthlyCsv({
      rows,
      portfolioNames,
      benchmarkSymbol,
      range,
      title: t("monthly.fileTitle", {
        start: range.start,
        end: range.end,
        currency: t(`currency.${currency}.name`),
        inflation: inflationAdjusted ? t("monthly.inflationOn") : t("monthly.inflationOff"),
      }),
      monthColumn: t("monthly.monthColumn"),
      summary: t("monthly.pureNote"),
    })

    // ข้อมูลอยู่ในเครื่องแล้ว จึงได้ไฟล์ทันทีโดยไม่ต้องรอโหลดอะไรเพิ่ม
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = csvFileName(range, t("monthly.fileNamePrefix"))
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-base leading-snug font-medium">
            {t("monthly.headingWithCount", { count: rows.length })}
          </h2>
          {/* ชุดของพอร์ตล้วน ๆ ต้องบอกไว้ทั้งบนจอและในไฟล์ (BR-CMP-81) */}
          <p className="text-xs text-pretty text-muted-foreground">{t("monthly.pureNote")}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          title={t("monthly.saveHint")}
          onClick={handleSave}
          data-testid="monthly-save"
        >
          <Download aria-hidden className="size-4" />
          {t("monthly.save")}
        </Button>
      </CardHeader>

      <CardContent>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            {t("monthly.heading")}
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[24rem] text-sm">
              <caption className="sr-only">
                {t("monthly.headingWithCount", { count: rows.length })}
              </caption>
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("monthly.monthColumn")}
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
              <tbody data-testid="monthly-table">
                {rows.map((row) => (
                  <tr key={row.month} className="border-b last:border-0">
                    <th scope="row" className="py-1 pr-3 text-left font-normal tabular-nums">
                      {monthLabel(row.month)}
                    </th>
                    {row.values.map((value, index) => (
                      <td
                        key={index}
                        className="py-1 pr-3 text-right tabular-nums"
                        data-testid={
                          portfolioNames.length === 1
                            ? `monthly-${row.month}`
                            : `monthly${index}-${row.month}`
                        }
                      >
                        {value === null ? NO_VALUE : formatPercent(value)}
                      </td>
                    ))}
                    <td className="py-1 text-right tabular-nums text-muted-foreground">
                      {row.benchmark === null ? NO_VALUE : formatPercent(row.benchmark)}
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
