"use client"

import { Separator } from "@/components/ui/separator"
import { useLanguage } from "@/i18n"

/**
 * คำเตือนการลงทุนที่ต้องมีทุกหน้า (BR-MVP-02)
 * รวมไว้ที่เดียวเพื่อให้ข้อความตรงกันทุกหน้าเสมอ
 */
export function SiteFooter() {
  const { t } = useLanguage()

  return (
    <footer className="px-6 py-4">
      <Separator className="mb-4" />
      <p className="text-center text-xs text-muted-foreground">{t("app.disclaimer")}</p>
    </footer>
  )
}
