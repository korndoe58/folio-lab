"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/i18n"

/** เวลาที่ป้าย "คัดลอกแล้ว" อยู่บนจอก่อนหายเอง โดยผู้ใช้ไม่ต้องกดปิด (BR-CMP-84) */
const FEEDBACK_MS = 2000

/**
 * คัดลอกลิงก์ผลลัพธ์ (US-22)
 *
 * ลิงก์คือที่อยู่ของหน้าเอง ไม่มีการย่อลิงก์และไม่ส่งอะไรออกนอกเครื่อง (BR-CMP-88)
 * และเป็นที่อยู่ของ**ผลที่แสดงอยู่จริง** ไม่ใช่ของค่าที่กำลังแก้ค้างในฟอร์ม เพราะที่อยู่
 * ถูกเปลี่ยนหลังรันสำเร็จเท่านั้น — คนที่เปิดลิงก์จึงเห็นผลเดียวกับคนที่ส่ง (EC-CMP-34)
 */
export function CopyLink() {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  /** ลิงก์ที่ต้องให้ผู้ใช้คัดลอกเอง เมื่อเบราว์เซอร์ไม่อนุญาต — null = ยังไม่ต้องแสดง */
  const [manualLink, setManualLink] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualBox = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const handleCopy = async () => {
    const link = window.location.href

    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // ล้มเหลวต้องมีทางออกเสมอ ไม่ใช่เงียบไป (BR-CMP-85)
      setManualLink(link)
      // รอให้กล่องถูกวาดก่อนแล้วค่อยเลือกข้อความให้ ผู้ใช้จึงกดคัดลอกได้ทันที
      requestAnimationFrame(() => manualBox.current?.select())
      return
    }

    setManualLink(null)
    setCopied(true)
    // กดซ้ำติด ๆ กันต้องไม่ทำให้ป้ายซ้อนกัน — ตั้งเวลาใหม่แทนที่จะเพิ่มอีกตัว (EC-CMP-33)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), FEEDBACK_MS)
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        data-testid="copy-link"
      >
        {copied ? (
          <Check aria-hidden className="size-4" />
        ) : (
          <Link2 aria-hidden className="size-4" />
        )}
        {copied ? t("share.copied") : t("share.copy")}
      </Button>

      {/* ประกาศให้โปรแกรมอ่านหน้าจอรู้ ไม่ใช่แค่เปลี่ยนหน้าตาปุ่ม (AC-CMP-63) */}
      <p role="status" className="sr-only">
        {copied ? t("share.copied") : ""}
      </p>

      {manualLink === null ? null : (
        <div className="flex w-full flex-col gap-1" data-testid="copy-link-manual">
          <label htmlFor="copy-link-box" className="text-xs font-medium">
            {t("share.manualHeading")}
          </label>
          <input
            id="copy-link-box"
            ref={manualBox}
            readOnly
            value={manualLink}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-input bg-transparent px-2 py-1 text-xs"
          />
          <p className="text-xs text-pretty text-muted-foreground">{t("share.manualHint")}</p>
        </div>
      )}
    </div>
  )
}
