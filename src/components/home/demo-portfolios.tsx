"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  DEMO_PORTFOLIOS,
  demoPortfolioHref,
  demoPortfolioMix,
} from "@/lib/backtest/demo-portfolios"
import { track } from "@/data/analytics/ga"
import { useLanguage } from "@/i18n"

/**
 * พอร์ตตัวอย่างบนหน้าแรก (US-11)
 * แต่ละใบเป็นลิงก์ที่มีค่าครบทุกช่อง กดแล้วผลขึ้นทันทีโดยไม่ต้องกดอะไรอีก (BR-DMO-03)
 */
export function DemoPortfolios() {
  const { t } = useLanguage()

  return (
    <section className="flex w-full max-w-4xl flex-col gap-3" aria-labelledby="demo-heading">
      <div className="text-center">
        <h2 id="demo-heading" className="font-heading text-lg font-medium">
          {t("demo.heading")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("demo.hint")}</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {DEMO_PORTFOLIOS.map((portfolio) => (
          <li key={portfolio.key} className="flex">
            <Link
              href={demoPortfolioHref(portfolio)}
              data-testid={`demo-${portfolio.key}`}
              // ยิงตอนกดก่อนเปลี่ยนหน้า · ชื่อชุดมาจากทะเบียนของเราเอง ไม่ใช่ที่ผู้ใช้พิมพ์ (BR-USE-16)
              onClick={() => track("use_demo_portfolio", { preset: portfolio.key })}
              className="flex w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="flex w-full flex-col transition-colors hover:border-primary/60">
                <CardHeader>
                  <h3 className="font-heading text-base leading-snug font-medium">
                    {t(`demo.${portfolio.key}.name`)}
                  </h3>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    {t(`demo.${portfolio.key}.description`)}
                  </p>
                  <p className="mt-auto font-mono text-xs text-foreground">
                    {demoPortfolioMix(portfolio)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
