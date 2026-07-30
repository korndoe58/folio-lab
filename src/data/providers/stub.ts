import {
  compareMonths,
  type MonthlyReturn,
  type PriceProvider,
  type SeriesResult,
  type YearMonth,
} from "@/types/series"
import advancBk from "@/data/fixtures/advanc-bk.json"
import aotBk from "@/data/fixtures/aot-bk.json"
import btcUsd from "@/data/fixtures/btc-usd.json"
import bnd from "@/data/fixtures/bnd.json"
import cpallBk from "@/data/fixtures/cpall-bk.json"
import deltaBk from "@/data/fixtures/delta-bk.json"
import downonly from "@/data/fixtures/downonly.json"
import gld from "@/data/fixtures/gld.json"
import kbankBk from "@/data/fixtures/kbank-bk.json"
import newfund from "@/data/fixtures/newfund.json"
import qqq from "@/data/fixtures/qqq.json"
import rf from "@/data/fixtures/rf.json"
import pttBk from "@/data/fixtures/ptt-bk.json"
import spy from "@/data/fixtures/spy.json"
import tdexBk from "@/data/fixtures/tdex-bk.json"
import thbx from "@/data/fixtures/thbx.json"
import tlt from "@/data/fixtures/tlt.json"
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
  // ★ สองตัวนี้อยู่ในรายการแนะนำมาตั้งแต่ S11 แต่เพิ่งมีชุดจำลองที่ S16b —
  // ก่อนหน้านี้เลือกจากรายการแล้วโหมดจำลองตอบว่าไม่พบข้อมูล (AC-CAT-05)
  "ADVANC.BK": advancBk as Fixture,
  "KBANK.BK": kbankBk as Fixture,
  // ตัวแทนหมวดใหม่ของแคตตาล็อก 100 ตัว — มีเท่าที่ชุดทดสอบต้องใช้ (BR-CAT-13)
  QQQ: qqq as Fixture,
  GLD: gld as Fixture,
  TLT: tlt as Fixture,
  "TDEX.BK": tdexBk as Fixture,
  "DELTA.BK": deltaBk as Fixture,
  // ข้อมูลเริ่มปี 2014 — ใช้เดินเส้นทางย่อช่วงเวลาเมื่อจับคู่กับตัวข้อมูลยาว (AC-CAT-13)
  "BTC-USD": btcUsd as Fixture,
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
