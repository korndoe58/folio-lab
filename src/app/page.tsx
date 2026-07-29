"use client"

import { ChartNoAxesCombined } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useLanguage } from "@/i18n"

export default function Home() {
  const { lang, setLang, t } = useLanguage()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="font-mono text-sm text-muted-foreground">{t("app.title")}</span>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("lang.label")}
          onClick={() => setLang(lang === "th" ? "en" : "th")}
        >
          {t("lang.switch")}
        </Button>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <ChartNoAxesCombined aria-hidden className="mx-auto mb-2 size-10 text-primary" />
            <CardTitle>
              <h1 className="text-3xl font-bold tracking-tight">{t("app.title")}</h1>
            </CardTitle>
            <CardDescription className="text-balance text-base">
              {t("app.tagline")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <Button size="lg" disabled>
              {t("app.startBacktest")}
            </Button>
            <span className="text-xs text-muted-foreground">{t("app.comingSoon")}</span>
          </CardContent>
        </Card>
      </main>

      <footer className="px-6 py-4">
        <Separator className="mb-4" />
        <p className="text-center text-xs text-muted-foreground">{t("app.disclaimer")}</p>
      </footer>
    </div>
  )
}
