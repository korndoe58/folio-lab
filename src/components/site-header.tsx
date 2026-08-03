"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { track } from "@/data/analytics/ga"
import { useLanguage } from "@/i18n"

/**
 * ส่วนหัวร่วมของทุกหน้า — ทุก story ที่เพิ่มหน้าใหม่ต้องใช้ตัวนี้
 * การแก้ที่นี่กระทบทุกหน้าพร้อมกัน (กฎ parity sweep)
 */
export function SiteHeader() {
  const { lang, setLang, t } = useLanguage()

  return (
    <header className="flex items-center justify-between px-6 py-4">
      <Link href="/" className="font-mono text-sm text-muted-foreground hover:text-foreground">
        {t("app.title")}
      </Link>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("lang.label")}
          onClick={() => {
            const to = lang === "th" ? "en" : "th"
            setLang(to)
            track("switch_language", { to })
          }}
        >
          {t("lang.switch")}
        </Button>
      </div>
    </header>
  )
}
