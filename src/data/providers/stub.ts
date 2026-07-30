import {
  compareMonths,
  type MonthlyReturn,
  type PriceProvider,
  type SeriesResult,
  type YearMonth,
} from "@/types/series"
import aotBk from "@/data/fixtures/aot-bk.json"
import bnd from "@/data/fixtures/bnd.json"
import cpallBk from "@/data/fixtures/cpall-bk.json"
import downonly from "@/data/fixtures/downonly.json"
import newfund from "@/data/fixtures/newfund.json"
import rf from "@/data/fixtures/rf.json"
import pttBk from "@/data/fixtures/ptt-bk.json"
import spy from "@/data/fixtures/spy.json"
import thbx from "@/data/fixtures/thbx.json"
import uponly from "@/data/fixtures/uponly.json"
import vnq from "@/data/fixtures/vnq.json"
import vti from "@/data/fixtures/vti.json"
import vxus from "@/data/fixtures/vxus.json"
import { normalizeSymbol } from "./market-data"

type Fixture = { symbol: string; source: string; returns: MonthlyReturn[] }

/** ชุดข้อมูลจำลองตาม BR-CCH-09 — ชุดอ้างอิงเป็นข้อมูลจริงที่ freeze ไว้ ส่วนที่เหลือสังเคราะห์ */
const FIXTURES: Record<string, Fixture> = {
  VTI: vti as Fixture,
  VNQ: vnq as Fixture,
  VXUS: vxus as Fixture,
  BND: bnd as Fixture,
  SPY: spy as Fixture,
  RF: rf as Fixture,
  NEWFUND: newfund as Fixture,
  DOWNONLY: downonly as Fixture,
  UPONLY: uponly as Fixture,
  // อัตราแลกเปลี่ยนและหุ้นไทย — จำเป็นเพื่อให้เดินเส้นทางแปลงค่าเงินในโหมดจำลองได้ (US-12..14)
  "THB=X": thbx as Fixture,
  "PTT.BK": pttBk as Fixture,
  "CPALL.BK": cpallBk as Fixture,
  "AOT.BK": aotBk as Fixture,
}

/** สัญลักษณ์พิเศษที่บังคับพฤติกรรมความล้มเหลว เพื่อให้เดินเส้นทาง error บนหน้าจอได้ */
const ALWAYS_UNREACHABLE = "ERRNET"

/** เดือนล่าสุดที่ชุดข้อมูลจำลองครอบคลุม — ตรึงไว้เพื่อให้ผลเท่าเดิมทุกครั้ง (BR-CCH-08) */
export const STUB_LAST_CLOSED_MONTH: YearMonth = "2026-06"

/**
 * StubProvider — implement สัญญาเดียวกับแหล่งข้อมูลจริงทุกประการ
 * ทำงานแบบ offline ล้วน ไม่พึ่งเครือข่ายและไม่พึ่งเวลาปัจจุบัน
 */
export function createStubProvider(): PriceProvider {
  return {
    lastClosedMonth() {
      return STUB_LAST_CLOSED_MONTH
    },

    async getMonthlySeries(rawSymbol, range) {
      const symbol = normalizeSymbol(rawSymbol)
      if (!symbol) {
        return { ok: false, failure: { kind: "symbol-not-found", symbol: rawSymbol.trim().toUpperCase() } }
      }

      if (symbol === ALWAYS_UNREACHABLE) {
        return { ok: false, failure: { kind: "unreachable", symbol, sourcesTried: 2 } }
      }

      const fixture = FIXTURES[symbol]
      if (!fixture) return { ok: false, failure: { kind: "symbol-not-found", symbol } }

      const end = compareMonths(range.end, STUB_LAST_CLOSED_MONTH) > 0 ? STUB_LAST_CLOSED_MONTH : range.end
      const returns = fixture.returns.filter(
        (r) => compareMonths(r.month, range.start) >= 0 && compareMonths(r.month, end) <= 0,
      )

      return okSeries(symbol, returns)
    },
  }
}

function okSeries(symbol: string, returns: MonthlyReturn[]): SeriesResult {
  return {
    ok: true,
    series: {
      symbol,
      returns,
      actualRange:
        returns.length > 0 ? { start: returns[0].month, end: returns[returns.length - 1].month } : null,
      source: "stub",
    },
  }
}
