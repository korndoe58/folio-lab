"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { formatMoney, formatPercent, NO_VALUE } from "@/lib/backtest/format"
import type { WithdrawalRow } from "@/lib/backtest/phase4-data"
import type { Currency } from "@/data/currency"
import { useLanguage } from "@/i18n"
import { parseYearMonth } from "@/types/series"

const MONTHS_PER_YEAR = 12

type Props = {
  rows: WithdrawalRow[]
  portfolioNames: string[]
  /** เงินตั้งต้นที่ผู้ใช้กรอก — ใช้แปลงอัตราเป็นจำนวนเงินต่อเดือน (BR-RSK-57) */
  amount: number
  currency: Currency
}

/**
 * ถอนได้เท่าไรโดยเงินไม่หมด (US-33)
 *
 * **จำนวนเงินต่อเดือนอยู่คู่กับเปอร์เซ็นต์เสมอ** (BR-RSK-57) เพราะคนตั้งงบเป็นเงิน
 * · และต้องมีคำเตือนเฉพาะของส่วนนี้ ชัดกว่าคำเตือนทั่วไปของเว็บ เพราะเป็นค่าที่คนเอาไป
 * วางแผนชีวิตจริง (BR-RSK-60)
 */
export function WithdrawalSection({ rows, portfolioNames, amount, currency }: Props) {
  const { t } = useLanguage()
  const single = portfolioNames.length === 1

  const monthLabel = (month: string) => {
    const { year, month: m } = parseYearMonth(month)
    return `${t(`monthsShort.${m}`)} ${year}`
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1">
        <h2 className="font-heading text-base leading-snug font-medium">
          {t("withdrawal.heading")}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">{t("withdrawal.intro")}</p>
        {/* คำเตือนเฉพาะของส่วนนี้ ไม่ใช่คำเตือนทั่วไปของเว็บ (BR-RSK-60) */}
        <p
          className="text-xs text-pretty font-medium text-muted-foreground"
          data-testid="withdrawal-warning"
        >
          {t("withdrawal.warning")}
        </p>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm" data-testid="withdrawal-table">
            <caption className="sr-only">{t("withdrawal.caption")}</caption>
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-3 font-medium">
                  {t("withdrawal.horizonColumn")}
                </th>
                {single ? null : (
                  <th scope="col" className="py-1 pr-3 font-medium">
                    {t("rolling.portfolioColumn")}
                  </th>
                )}
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {t("metric.safeWithdrawalRate.label")}
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {t("metric.withdrawalAmount.label")}
                </th>
                <th scope="col" className="py-1 font-medium">
                  {t("metric.testedWindows.label")}
                </th>
              </tr>
            </thead>
            <tbody data-testid="withdrawal-rows">
              {rows.flatMap((row) =>
                row.portfolios.map((result, index) => {
                  const cellId = (part: string) =>
                    single
                      ? `withdrawal-${part}-${row.years}`
                      : `withdrawal${index}-${part}-${row.years}`
                  const monthly =
                    result.rate === null ? null : (result.rate * amount) / MONTHS_PER_YEAR

                  return (
                    <tr key={`${row.years}-${index}`} className="border-b last:border-0 align-top">
                      {index === 0 ? (
                        <th
                          scope="rowgroup"
                          rowSpan={row.portfolios.length}
                          className="py-1.5 pr-3 text-left align-top font-normal tabular-nums"
                        >
                          {t("withdrawal.years", { count: row.years })}
                        </th>
                      ) : null}
                      {single ? null : (
                        <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                          {portfolioNames[index]}
                        </th>
                      )}

                      <td
                        className="py-1.5 pr-3 text-right font-medium tabular-nums"
                        data-testid={cellId("rate")}
                      >
                        {/* ชนเพดานต้องบอกว่า "มากกว่า 20%" ไม่ใช่โชว์ 20% เหมือนเป็นคำตอบที่แม่น */}
                        {result.atCeiling
                          ? t("withdrawal.aboveCeiling", { rate: formatPercent(result.rate) })
                          : formatPercent(result.rate)}
                      </td>
                      <td
                        className="py-1.5 pr-3 text-right tabular-nums"
                        data-testid={cellId("amount")}
                      >
                        {monthly === null ? NO_VALUE : formatMoney(monthly, currency)}
                      </td>
                      <td className="py-1.5 text-xs text-muted-foreground" data-testid={cellId("windows")}>
                        {result.rate === null ? (
                          t("withdrawal.tooShort", { years: row.years })
                        ) : (
                          <>
                            {t("withdrawal.windowCount", { count: result.windows })}
                            {result.worstWindowStart ? (
                              <span className="block">
                                {t("withdrawal.worstWindow", {
                                  month: monthLabel(result.worstWindowStart),
                                })}
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
