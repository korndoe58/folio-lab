import path from "node:path"
import { NextResponse } from "next/server"
import { createFsCache } from "@/data/cache/fs-cache"
import { createMarketData } from "@/data/providers/market-data"
import { createStooqSource } from "@/data/providers/stooq"
import { createYahooSource } from "@/data/providers/yahoo"
import type { MonthRange } from "@/types/series"

/**
 * เส้นทางฝั่งเครื่องแม่ข่ายสำหรับขอผลตอบแทนรายเดือน
 *
 * แหล่งข้อมูลจริงเรียกจากเบราว์เซอร์ตรงไม่ได้ (ถูกนโยบายข้ามโดเมนปิดกั้น และคลังข้อมูลเขียนไฟล์)
 * ชั้นข้อมูลทั้งชุดจึงทำงานที่นี่ ส่วนหน้าจอเรียกผ่านเส้นทางนี้ทางเดียว — ชั้นคำนวณและหน้าจอ
 * ไม่ต้องรู้เลยว่าเบื้องหลังเปลี่ยนไป (R15)
 */

// บนเครื่องให้บริการจริงเขียนได้เฉพาะโฟลเดอร์ชั่วคราว — คลังจึงหายเมื่อเครื่องถูกปลุกใหม่
// ยอมรับได้เพราะคำตอบถูกเก็บซ้ำที่ชั้นแคชของเครือข่ายอีกที (ดู Cache-Control ด้านล่าง)
const CACHE_DIR = process.env.VERCEL ? path.join("/tmp", "folio-cache") : undefined

const provider = createMarketData({
  sources: [createYahooSource(), createStooqSource()],
  cache: createFsCache({ dir: CACHE_DIR }),
})

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const symbol = params.get("symbol") ?? ""
  const start = params.get("start")
  const end = params.get("end")

  if (!symbol || !start || !end) {
    return NextResponse.json({ ok: false, failure: { kind: "symbol-not-found", symbol } }, { status: 400 })
  }

  const range: MonthRange = { start, end }
  const result = await provider.getMonthlySeries(symbol, range)

  if (!result.ok) {
    // ไม่พบสัญลักษณ์เป็นคำตอบที่ถูกต้อง จึงตอบ 200 พร้อมชนิดของความล้มเหลว
    // ส่วนติดต่อแหล่งข้อมูลไม่ได้ ตอบ 502 เพื่อไม่ให้ถูกเก็บแคชไว้
    const status = result.failure.kind === "symbol-not-found" ? 200 : 502
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(result, {
    headers: {
      // เดือนที่ปิดแล้วไม่เปลี่ยนอีก คำตอบจึงเก็บได้ยาว ส่วนเดือนล่าสุดกันไว้ด้วยการหมดอายุรายวัน
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  })
}
