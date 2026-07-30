import type { MonthRange, PriceProvider, SeriesResult } from "@/types/series"
import { lastClosedMonthFrom } from "./market-data"
import { createStubProvider } from "./stub"

/**
 * จุดเดียวที่หน้าจอขอข้อมูลได้ (R15)
 *
 * โหมดข้อมูลจริงเรียกผ่านเส้นทางฝั่งเครื่องแม่ข่าย เพราะแหล่งข้อมูลจริงเรียกจากเบราว์เซอร์ตรงไม่ได้
 * (ถูกนโยบายข้ามโดเมนปิดกั้น และคลังข้อมูลเขียนไฟล์)
 * โหมดจำลองอ่านจากชุดข้อมูลที่ตรึงไว้ ใช้ตอนทดสอบเพื่อให้ผลเหมือนเดิมทุกครั้ง
 * ทั้งสองโหมดใช้สัญญาเดียวกัน หน้าจอจึงไม่รู้ว่าเบื้องหลังเป็นแบบไหน
 */
export function getBrowserProvider(): PriceProvider {
  return process.env.NEXT_PUBLIC_DATA_MODE === "stub" ? createStubProvider() : createHttpProvider()
}

function createHttpProvider(): PriceProvider {
  return {
    /** คำนวณจากปฏิทินฝั่งผู้ใช้ ไม่ต้องถามเครื่องแม่ข่าย (BR-FND-01) */
    lastClosedMonth() {
      return lastClosedMonthFrom(new Date())
    },

    async getMonthlySeries(symbol: string, range: MonthRange): Promise<SeriesResult> {
      const query = new URLSearchParams({ symbol, start: range.start, end: range.end })
      try {
        const response = await fetch(`/api/series?${query}`)
        const body = (await response.json()) as SeriesResult
        // คำตอบที่อ่านไม่ออกถือว่าติดต่อไม่ได้ เพื่อให้ผู้ใช้เห็นข้อความที่ลองใหม่ได้
        if (typeof body?.ok !== "boolean") return unreachable(symbol)
        return body
      } catch {
        return unreachable(symbol)
      }
    },
  }
}

function unreachable(symbol: string): SeriesResult {
  return {
    ok: false,
    failure: { kind: "unreachable", symbol: symbol.trim().toUpperCase(), sourcesTried: 0 },
  }
}
