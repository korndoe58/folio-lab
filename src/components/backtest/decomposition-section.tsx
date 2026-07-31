"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { formatMoney, formatPercent } from "@/lib/backtest/format"
import type { AssetContribution } from "@/engine"
import type { Currency } from "@/data/currency"
import { useLanguage } from "@/i18n"
import { PortfolioPicker } from "./portfolio-picker"

type Props = {
  /** หนึ่งชุดต่อพอร์ต เรียงตามลำดับพอร์ต */
  decompositions: AssetContribution[][]
  portfolioNames: string[]
  currency: Currency
}

/**
 * น้ำหนักที่ใส่ กับ ความเสี่ยงที่รับจริง (US-29)
 *
 * **น้ำหนักอยู่ติดกับส่วนแบ่งความเสี่ยงโดยตั้งใจ** เพราะคุณค่าทั้งหมดของส่วนนี้
 * คือการเห็นว่าสองค่านี้ไม่เท่ากัน (BR-RSK-40)
 */
export function DecompositionSection({ decompositions, portfolioNames, currency }: Props) {
  const { t } = useLanguage()
  const [selected, setSelected] = useState(0)
  const rows = decompositions[selected]
  if (!rows || rows.length === 0) return null

  const anyNegativeRisk = rows.some((row) => (row.riskShare ?? 0) < 0)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-base leading-snug font-medium">
            {t("decomposition.heading")}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">{t("decomposition.intro")}</p>
          {/* ค่าติดลบเป็นเรื่องดี ต้องอธิบายไว้ ไม่ใช่ปล่อยให้ตกใจ (BR-RSK-39) */}
          {anyNegativeRisk ? (
            <p className="text-xs text-pretty text-muted-foreground">
              {t("decomposition.negativeNote")}
            </p>
          ) : null}
        </div>
        <PortfolioPicker
          id="decomposition-portfolio"
          names={portfolioNames}
          selected={selected}
          onSelect={setSelected}
        />
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm" data-testid="decomposition-table">
            <caption className="sr-only">
              {t("decomposition.caption", { name: portfolioNames[selected] })}
            </caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-medium">
                  {t("decomposition.assetColumn")}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {t("decomposition.weightColumn")}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {t("metric.riskContribution.label")}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {t("metric.returnContribution.label")}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {t("metric.contributionAmount.label")}
                </th>
              </tr>
            </thead>
            <tbody data-testid="decomposition-rows">
              {rows.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <th scope="row" className="py-1 pr-3 text-left font-normal">
                    {row.label}
                  </th>
                  <td
                    className="py-1 pr-3 text-right tabular-nums text-muted-foreground"
                    data-testid={`decomposition-${row.label}-weight`}
                  >
                    {formatPercent(row.targetWeight)}
                  </td>
                  <td
                    className="py-1 pr-3 text-right font-medium tabular-nums"
                    data-testid={`decomposition-${row.label}-risk`}
                  >
                    {formatPercent(row.riskShare)}
                  </td>
                  <td
                    className="py-1 pr-3 text-right tabular-nums"
                    data-testid={`decomposition-${row.label}-return`}
                  >
                    {formatPercent(row.returnShare)}
                  </td>
                  <td
                    className="py-1 text-right tabular-nums"
                    data-testid={`decomposition-${row.label}-amount`}
                  >
                    {formatMoney(row.contributionAmount, currency)}
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
