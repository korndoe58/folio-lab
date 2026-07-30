"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/i18n"

/**
 * ปุ่มสลับโหมดสว่าง/มืด — ไอคอนสลับด้วย CSS ตามคลาสบน <html>
 * จึงไม่ต้องรอให้หน้าโหลดเสร็จก่อนแสดงผล และไม่เกิดอาการกะพริบตอนเปิดหน้า
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useLanguage()

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("theme.label")}
      title={t("theme.label")}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun aria-hidden className="size-4 dark:hidden" />
      <Moon aria-hidden className="hidden size-4 dark:block" />
    </Button>
  )
}
