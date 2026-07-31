"use client"

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox"

/** หนึ่งหมวดในกล่องที่กางลงมา — `label` คือหัวข้อที่ผู้ใช้เห็น (BR-CAT-15) */
export type ComboboxItemGroup = {
  label: string
  items: readonly string[]
}

type Props = {
  id: string
  value: string
  /** รายการแบน — ใช้กับช่องที่ตัวเลือกไม่เยอะ (สกุลเงิน · ปี) */
  items?: readonly string[]
  /**
   * รายการแบ่งหมวด — ใช้แทน `items` เมื่อตัวเลือกเยอะจนรายการแบนอ่านไม่ไหว
   * ส่งมาแค่อันเดียวเท่านั้นระหว่างสองอัน
   */
  groups?: readonly ComboboxItemGroup[]
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
 *
 * รองรับสองรูปแบบ: **รายการแบน** (ของเดิม ไม่เปลี่ยนสัญญา) และ **รายการแบ่งหมวด**
 * ที่มีหัวข้อคั่น (BR-CAT-15) · ตัวประกอบข้างล่างกรองข้ามหมวดและตัดหมวดที่ไม่เหลือ
 * ตัวเลือกออกให้เอง จึงไม่ต้องเขียนตรรกะการกรองซ้ำที่นี่ (BR-CAT-16)
 */
export function ComboboxField({
  id,
  value,
  items,
  groups,
  emptyLabel,
  placeholder,
  inputMode,
  invalid,
  describedBy,
  describe,
  onValueChange,
  onBlur,
}: Props) {
  // ตัวประกอบดูจากรูปของรายการเองว่าแบ่งหมวดหรือไม่ — หมวดคือวัตถุที่มีคีย์ `items`
  const source = groups ?? items ?? []

  /**
   * รายการแบ่งหมวดวางสองบรรทัด — สัญลักษณ์บนสุด คำอธิบายกับปีข้อมูลบรรทัดล่าง (BR-FRM-07)
   *
   * คำอธิบายไทยของสินทรัพย์ยาวกว่าที่ช่องกรอกกว้างมาก การวางต่อกันในบรรทัดเดียวจึงถูกตัด
   * เป็นหลายบรรทัดจนกวาดตาไม่ได้บนมือถือ · รายการแบน (สกุลเงิน · ปี) ยังบรรทัดเดียวเหมือนเดิม
   * เพราะตัวเลือกสั้นและไม่มีคำอธิบายยาว (BR-FRM-08)
   */
  const renderItem = (item: string) => {
    const description = describe?.(item)
    if (groups) {
      return (
        <ComboboxItem key={item} value={item} className="flex-col items-start gap-0.5 py-1.5">
          <span className="font-medium tabular-nums">{item}</span>
          {description ? (
            <span className="text-xs text-pretty text-muted-foreground">{description}</span>
          ) : null}
        </ComboboxItem>
      )
    }
    return (
      <ComboboxItem key={item} value={item}>
        <span className="font-medium tabular-nums">{item}</span>
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </ComboboxItem>
    )
  }

  return (
    // ผูกทั้งค่าที่เลือกและข้อความในช่องเข้ากับ state เดียวกัน มิฉะนั้นข้อความที่พิมพ์เอง
    // (ซึ่งไม่ตรงรายการแนะนำ) จะถูกล้างทิ้งตอนออกจากช่อง
    <Combobox
      items={source}
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
      {/*
        รายการแบ่งหมวดกว้างได้ถึง 24rem โดยไม่ผูกกับความกว้างของช่องกรอก (BR-FRM-05) —
        ช่องสัญลักษณ์แบ่งแถวกับช่องน้ำหนัก บนจอ 375 จุดจึงเหลือราว 200 จุดซึ่งแคบเกินอ่าน ·
        `max-w` ของตัวประกอบครอบให้ไม่ล้นจออยู่แล้ว จอแคบจึงได้กว้างเกือบเต็มจอ (BR-FRM-06)
      */}
      <ComboboxContent
        className={groups ? "min-w-[min(24rem,var(--available-width))]" : undefined}
      >
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {groups
            ? (group: ComboboxItemGroup) => (
                <ComboboxGroup key={group.label} items={group.items}>
                  <ComboboxLabel className="font-medium text-foreground">
                    {group.label}
                  </ComboboxLabel>
                  <ComboboxCollection>{renderItem}</ComboboxCollection>
                </ComboboxGroup>
              )
            : (item: string) => renderItem(item)}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
