"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { formatRatio } from "@/lib/backtest/format"
import type { CorrelationMatrix } from "@/engine"
import { useLanguage } from "@/i18n"
import { PortfolioPicker } from "./portfolio-picker"

type Props = {
  /** หนึ่งตารางต่อพอร์ต เรียงตามลำดับพอร์ต */
  matrices: CorrelationMatrix[]
  portfolioNames: string[]
}

/**
 * ของที่ถืออยู่ขึ้นลงพร้อมกันแค่ไหน (US-28)
 *
 * ตารางสามเหลี่ยม เพราะค่าของคู่ ก–ข เท่ากับ ข–ก เสมอ ครึ่งบนจึงไม่ต้องแสดง (BR-RSK-29)
 * แสดงทีละพอร์ต เพราะซ้อนสามตารางบนจอเดียวอ่านไม่ออก (BR-RSK-06)
 */
export function CorrelationSection({ matrices, portfolioNames }: Props) {
  const { t } = useLanguage()
  const [selected, setSelected] = useState(0)
  const matrix = matrices[selected]
  if (!matrix || matrix.labels.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-base leading-snug font-medium">
            {t("correlation.heading")}
          </h2>
          {/* เลขสูงแปลว่าอะไร ต้องบอกด้วยภาษาที่คนไม่ได้เรียนการเงินเข้าใจ (BR-RSK-33) */}
          <p className="text-sm text-pretty text-muted-foreground">{t("correlation.intro")}</p>
          {/* ประโยคเดียวกับที่หน้าต่างเลื่อนใช้ — เก็บไว้คีย์เดียว แก้ที่เดียวเปลี่ยนทั้งสองที่ */}
          <p className="text-xs text-pretty text-muted-foreground">{t("rolling.pureNote")}</p>
        </div>
        <PortfolioPicker
          id="correlation-portfolio"
          names={portfolioNames}
          selected={selected}
          onSelect={setSelected}
        />
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm" data-testid="correlation-table">
            <caption className="sr-only">
              {t("correlation.caption", { name: portfolioNames[selected] })}
            </caption>
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-3 text-left font-medium" />
                {matrix.labels.map((label) => (
                  <th key={label} scope="col" className="py-1 pr-3 text-right font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody data-testid="correlation-rows">
              {matrix.rows.map((cells, rowIndex) => (
                <tr key={matrix.labels[rowIndex]} className="border-b last:border-0">
                  <th scope="row" className="py-1 pr-3 text-left font-normal">
                    {matrix.labels[rowIndex]}
                  </th>
                  {matrix.labels.map((label, columnIndex) => {
                    // ครึ่งบนซ้ำกับครึ่งล่าง จึงเว้นว่างไว้ (BR-RSK-29)
                    if (columnIndex > rowIndex) return <td key={label} className="py-1 pr-3" />
                    return (
                      <td
                        key={label}
                        className="py-1 pr-3 text-right tabular-nums"
                        data-testid={`correlation-${matrix.labels[rowIndex]}-${label}`}
                      >
                        {formatRatio(cells[columnIndex])}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
