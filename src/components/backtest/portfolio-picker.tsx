"use client"

import { Label } from "@/components/ui/label"
import { useLanguage } from "@/i18n"

type Props = {
  id: string
  names: string[]
  selected: number
  onSelect: (index: number) => void
}

/**
 * ตัวเลือกพอร์ตของตารางใหญ่ (BR-RSK-06)
 *
 * ตารางความสัมพันธ์และตารางแยกส่วนมีหลายแถวหลายคอลัมน์ ซ้อนสามพอร์ตบนจอเดียวอ่านไม่ออก
 * จึงแสดงทีละพอร์ต · **พอร์ตเดียวไม่มีตัวเลือก** จอของการใช้งานปกติจึงไม่มีของเกิน
 */
export function PortfolioPicker({ id, names, selected, onSelect }: Props) {
  const { t } = useLanguage()
  if (names.length <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {t("risk.portfolioPicker")}
      </Label>
      <select
        id={id}
        value={selected}
        onChange={(event) => onSelect(Number(event.target.value))}
        className="h-8 rounded-md border bg-transparent px-2 text-sm"
      >
        {names.map((name, index) => (
          <option key={index} value={index}>
            {name}
          </option>
        ))}
      </select>
    </div>
  )
}
