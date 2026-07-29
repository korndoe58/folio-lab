import { Suspense } from "react"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { BacktestClient } from "./backtest-client"

export default function BacktestPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Suspense>
          <BacktestClient />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
