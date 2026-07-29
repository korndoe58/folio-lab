"use client"

import { ChartNoAxesCombined } from "lucide-react"
import Link from "next/link"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/i18n"

export default function Home() {
  const { t } = useLanguage()

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

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
            <Link
              href="/backtest"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t("app.startBacktest")}
            </Link>
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  )
}
