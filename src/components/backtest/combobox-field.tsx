"use client"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

type Props = {
  id: string
  value: string
  items: readonly string[]
  emptyLabel: string
  placeholder?: string
  inputMode?: "numeric" | "decimal"
  invalid?: boolean
  describedBy?: string
  /** คำอธิบายรองที่แสดงข้างตัวเลือก เช่น ชื่อสินทรัพย์ */
  describe?: (item: string) => string | undefined
  onValueChange: (value: string) => void
  onBlur?: (value: string) => void
}

/**
 * ช่องกรอกที่มีรายการแนะนำให้เลือก แต่พิมพ์ค่านอกรายการได้เสมอ (BR-CFG-05)
 * ค่าที่พิมพ์คือค่าจริงของช่อง รายการทำหน้าที่แค่ช่วยกรอกให้เร็วขึ้น
 */
export function ComboboxField({
  id,
  value,
  items,
  emptyLabel,
  placeholder,
  inputMode,
  invalid,
  describedBy,
  describe,
  onValueChange,
  onBlur,
}: Props) {
  return (
    // ผูกทั้งค่าที่เลือกและข้อความในช่องเข้ากับ state เดียวกัน มิฉะนั้นข้อความที่พิมพ์เอง
    // (ซึ่งไม่ตรงรายการแนะนำ) จะถูกล้างทิ้งตอนออกจากช่อง
    <Combobox
      items={items}
      value={value}
      inputValue={value}
      // รายการแนะนำเป็นตัวช่วยกรอก ไม่ใช่ขั้นตอนที่ต้องปิดก่อน — ส่วนอื่นของฟอร์มต้องกดได้ตลอด
      modal={false}
      onValueChange={(next) => {
        if (typeof next === "string" && next !== value) onValueChange(next)
      }}
      onInputValueChange={(next) => onValueChange(next)}
    >
      <ComboboxInput
        id={id}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={(event) => onBlur?.(event.target.value)}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              <span className="font-medium tabular-nums">{item}</span>
              {describe?.(item) ? (
                <span className="text-xs text-muted-foreground">{describe(item)}</span>
              ) : null}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
