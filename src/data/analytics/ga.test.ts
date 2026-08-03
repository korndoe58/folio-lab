import { afterEach, describe, expect, it, vi } from "vitest"
import { analyticsEnabled, track, type Sender } from "./ga"

/**
 * ทั้งชุดนี้ออฟไลน์ล้วน — ใช้ตัวส่งปลอมที่ฉีดเข้าไป ไม่มีอะไรออกจาก process (BR-USE-18)
 *
 * **ชุดนี้พิสูจน์อะไรไม่ได้:** พิสูจน์ไม่ได้ว่าปลายทางรับข้อมูลได้จริงหรือแสดงผลถูก —
 * ยืนยันได้แค่ว่าเราส่งอะไรออกไปและไม่ส่งอะไรออกไป · ปลายทางต้องดูบนรุ่นที่ build แล้ว
 * ด้วยรหัสจริง (แผนตรวจสอบของ US-37)
 */

/** ตัวส่งปลอมที่จดทุกครั้งที่ถูกเรียก */
function spy() {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = []
  const sender: Sender = (_command, name, params) => calls.push({ name, params })
  return { calls, sender }
}

const enable = () => {
  vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST123456")
  vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "live")
}

afterEach(() => vi.unstubAllEnvs())

describe("สวิตช์เปิดปิด", () => {
  it("ไม่มีรหัสวัดผล = ปิด (BR-USE-03)", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "")
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "live")
    expect(analyticsEnabled()).toBe(false)
  })

  it("โหมดข้อมูลจำลอง = ปิด แม้จะมีรหัสวัดผล (BR-USE-04)", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST123456")
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "stub")
    // สภาพนี้คือสภาพที่ชุดทดสอบ e2e รันอยู่จริง — ด่านนี้คือตัวกันข้อมูลปน
    expect(analyticsEnabled()).toBe(false)
  })

  it("มีรหัสและไม่ใช่โหมดจำลอง = เปิด", () => {
    enable()
    expect(analyticsEnabled()).toBe(true)
  })

  it("สองด่านแยกจากกัน — ปิดด่านใดด่านหนึ่งก็พอ", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "")
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "stub")
    expect(analyticsEnabled()).toBe(false)
  })
})

describe("track", () => {
  it("ส่งชื่อเหตุการณ์และพารามิเตอร์ตามที่ให้มา (BR-USE-10)", () => {
    enable()
    const { calls, sender } = spy()

    track(
      "run_backtest",
      {
        portfolio_count: 2,
        base_currency: "USD",
        span_years: 14,
        inflation_adjusted: false,
        has_cashflow: true,
      },
      sender,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0].name).toBe("run_backtest")
    expect(calls[0].params).toEqual({
      portfolio_count: 2,
      base_currency: "USD",
      span_years: 14,
      inflation_adjusted: false,
      has_cashflow: true,
    })
  })

  it("ไม่ส่งอะไรเลยเมื่อปิดอยู่ (AC-USE-04, AC-USE-05)", () => {
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST123456")
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", "stub")
    const { calls, sender } = spy()

    track("copy_link", {}, sender)
    track("download_csv", { month_count: 174 }, sender)

    expect(calls).toHaveLength(0)
  })

  it("ไม่โยนและไม่ส่งเมื่อตัวส่งยังไม่พร้อมหรือถูกบล็อก (EC-USE-01)", () => {
    enable()
    expect(() => track("copy_link", {}, undefined)).not.toThrow()
  })

  it("เหตุการณ์ที่เหลือส่งพารามิเตอร์ครบตามที่การ์ดระบุ", () => {
    enable()
    const { calls, sender } = spy()

    track("compare_portfolios", { portfolio_count: 3 }, sender)
    track("copy_link", {}, sender)
    track("download_csv", { month_count: 174 }, sender)
    track("use_demo_portfolio", { preset: "classic6040" }, sender)
    track("switch_language", { to: "en" }, sender)

    expect(calls.map((c) => c.name)).toEqual([
      "compare_portfolios",
      "copy_link",
      "download_csv",
      "use_demo_portfolio",
      "switch_language",
    ])
    expect(calls[0].params).toEqual({ portfolio_count: 3 })
    expect(calls[2].params).toEqual({ month_count: 174 })
    expect(calls[4].params).toEqual({ to: "en" })
  })

  it("★ ไม่มีพารามิเตอร์ตัวไหนพาจำนวนเงินหรือสัญลักษณ์ออกไปได้ (BR-USE-01, AC-USE-03)", () => {
    enable()
    const { calls, sender } = spy()

    track(
      "run_backtest",
      {
        portfolio_count: 1,
        base_currency: "THB",
        span_years: 10,
        inflation_adjusted: true,
        has_cashflow: false,
      },
      sender,
    )

    // ชนิดของ EventParams กันไว้ตอนคอมไพล์แล้ว ข้อนี้กันตอนรันอีกชั้นเผื่อชนิดถูกคลายในอนาคต
    const serialized = JSON.stringify(calls)
    for (const forbidden of ["VTI", "BND", "PTT.BK", "10000", "350000"]) {
      expect(serialized, `ห้ามมี ${forbidden} ในสิ่งที่ส่งออก`).not.toContain(forbidden)
    }
  })
})
