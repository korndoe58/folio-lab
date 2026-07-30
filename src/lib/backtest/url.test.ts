import { describe, expect, test } from "vitest"
import { decodeConfig, defaultConfig, encodeConfig, isEmptyParams } from "./url"
import { DEFAULT_BASE_CURRENCY } from "@/types/backtest"

const LAST_CLOSED_YEAR = 2026
const params = (query: string) => new URLSearchParams(query)

describe("US-06 อ่านค่าจากลิงก์", () => {
  test("AC-URL-02 ลิงก์ครบถูกอ่านได้ทุกค่า", () => {
    const result = decodeConfig(
      params("assets=VTI:60,BND:40&start=2015&end=2025&amount=10000&benchmark=SPY"),
      LAST_CLOSED_YEAR,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config).toEqual({
      assets: [
        { symbol: "VTI", weight: "60" },
        { symbol: "BND", weight: "40" },
      ],
      startYear: 2015,
      endYear: 2025,
      baseCurrency: "USD",
      amount: 10_000,
      benchmark: "SPY",
    })
  })

  test("AC-URL-04 ค่าที่ไม่ระบุใช้ค่าเริ่มต้น (ช่วงปี 10 ปีล่าสุดตาม BR-CFG-16)", () => {
    const result = decodeConfig(params("assets=VTI:60,BND:40"), LAST_CLOSED_YEAR)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.amount).toBe(10_000)
    expect(result.config.benchmark).toBe("SPY")
    expect(result.config.startYear).toBe(2016)
    expect(result.config.endYear).toBe(2026)
  })

  test("EC-URL-01 ลิงก์ไม่มีค่าเลย ถือเป็นฟอร์มเปล่า ไม่ใช่ข้อผิดพลาด", () => {
    expect(isEmptyParams(params(""))).toBe(true)
    expect(isEmptyParams(params("assets=VTI:100"))).toBe(false)

    const result = decodeConfig(params(""), LAST_CLOSED_YEAR)
    expect(result.ok).toBe(true)
    // เหมือนฟอร์มเปล่าทุกช่อง ยกเว้นสกุลเงินซึ่งเป็นกฎของลิงก์ (ดูเทสต์ถัดไป)
    if (result.ok) {
      expect({ ...result.config, baseCurrency: DEFAULT_BASE_CURRENCY }).toEqual(
        defaultConfig(LAST_CLOSED_YEAR),
      )
    }
  })

  test("BR-CUR-03 ลิงก์ที่ไม่ระบุสกุลเงิน ถือเป็นดอลลาร์ เพื่อไม่ให้ลิงก์ที่แชร์ไปแล้วเปลี่ยนค่า", () => {
    // ลิงก์จริงจากหลักฐานของ S8 ซึ่งสร้างขึ้นก่อนมีตัวเลือกสกุลเงิน
    const legacy = "assets=VTI:60,BND:40&start=2015&end=2025&amount=10000&benchmark=SPY"
    const result = decodeConfig(params(legacy), LAST_CLOSED_YEAR)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.config.baseCurrency).toBe("USD")
  })

  test("BR-CUR-01 ฟอร์มเปล่าเริ่มที่เงินบาท ต่างจากกฎของลิงก์เก่าโดยตั้งใจ", () => {
    expect(defaultConfig(LAST_CLOSED_YEAR).baseCurrency).toBe("THB")
  })

  test("EC-CUR-01 สกุลเงินที่ไม่รู้จักในลิงก์ ถือว่าอ่านโครงสร้างไม่ออก", () => {
    const result = decodeConfig(params("assets=VTI:100&base=EUR"), LAST_CLOSED_YEAR)
    expect(result.ok).toBe(false)
  })

  test("อ่านสกุลเงินจากลิงก์ได้ทั้งสองค่า ไม่สนตัวพิมพ์", () => {
    for (const [raw, expected] of [["THB", "THB"], ["usd", "USD"]] as const) {
      const result = decodeConfig(params(`assets=VTI:100&base=${raw}`), LAST_CLOSED_YEAR)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.config.baseCurrency).toBe(expected)
    }
  })

  test("AC-URL-05 น้ำหนักไม่ใช่ตัวเลข ถือว่าโครงสร้างเสีย", () => {
    const result = decodeConfig(params("assets=VTI:abc"), LAST_CLOSED_YEAR)
    expect(result.ok).toBe(false)
  })

  test("AC-URL-06 ลิงก์ตัดกลางคัน ถือว่าโครงสร้างเสียแต่ยังเติมส่วนที่อ่านได้", () => {
    const result = decodeConfig(params("assets=VTI:60,BN"), LAST_CLOSED_YEAR)

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.partial.assets).toEqual([{ symbol: "VTI", weight: "60" }])
  })

  test("AC-URL-07 สินทรัพย์เกิน 10 รายการ ถือว่าโครงสร้างเสีย", () => {
    const many = Array.from({ length: 12 }, (_, i) => `S${i}:8`).join(",")
    expect(decodeConfig(params(`assets=${many}`), LAST_CLOSED_YEAR).ok).toBe(false)

    const ten = Array.from({ length: 10 }, (_, i) => `S${i}:10`).join(",")
    expect(decodeConfig(params(`assets=${ten}`), LAST_CLOSED_YEAR).ok).toBe(true)
  })

  test("EC-URL-02/03 ค่าที่อ่านออกแต่ผิดกฎฟอร์ม ไม่ถือว่าโครงสร้างเสีย", () => {
    // น้ำหนักรวมไม่ครบ 100 → ให้การตรวจของฟอร์มจัดการ ไม่ใช่ V-008
    expect(decodeConfig(params("assets=VTI:60,BND:30"), LAST_CLOSED_YEAR).ok).toBe(true)
    // สัญลักษณ์ที่อาจไม่มีข้อมูล → อ่านโครงสร้างได้ ให้ฟอร์มตรวจต่อ
    expect(decodeConfig(params("assets=ZZZZZ:100"), LAST_CLOSED_YEAR).ok).toBe(true)
    // ปีสลับกัน → อ่านได้ ให้ฟอร์มแจ้ง V-004
    expect(decodeConfig(params("assets=VTI:100&start=2020&end=2015"), LAST_CLOSED_YEAR).ok).toBe(true)
  })

  test("EC-URL-04 ตัวคั่นซ้ำหรือช่องว่างเกิน ข้ามส่วนที่ว่างแล้วอ่านต่อ", () => {
    const result = decodeConfig(params("assets=VTI:60,,BND:40"), LAST_CLOSED_YEAR)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.assets).toHaveLength(2)
  })

  test("EC-URL-05 พารามิเตอร์ซ้ำ ใช้ค่าแรก", () => {
    const result = decodeConfig(
      params("assets=VTI:100&start=2015&start=2020"),
      LAST_CLOSED_YEAR,
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.config.startYear).toBe(2015)
  })

  test("ค่าปีหรือเงินที่อ่านไม่ออก ถือว่าโครงสร้างเสีย", () => {
    expect(decodeConfig(params("assets=VTI:100&start=xx"), LAST_CLOSED_YEAR).ok).toBe(false)
    expect(decodeConfig(params("assets=VTI:100&amount=-5"), LAST_CLOSED_YEAR).ok).toBe(false)
  })

  test("สัญลักษณ์ตัวพิมพ์เล็กถูกแปลงเป็นตัวพิมพ์ใหญ่", () => {
    const result = decodeConfig(params("assets=vti:100&benchmark=spy"), LAST_CLOSED_YEAR)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.assets[0].symbol).toBe("VTI")
    expect(result.config.benchmark).toBe("SPY")
  })
})

describe("US-06 เขียนค่าลงลิงก์", () => {
  test("AC-URL-01 รูปแบบลิงก์ตาม BR-URL-02 และอ่านออกในแถบที่อยู่", () => {
    const encoded = encodeConfig({
      assets: [
        { symbol: "VTI", weight: "60" },
        { symbol: "BND", weight: "40" },
      ],
      startYear: 2015,
      endYear: 2025,
      baseCurrency: "USD",
      amount: 10_000,
      benchmark: "SPY",
    })

    expect(encoded).toBe(
      "assets=VTI:60,BND:40&start=2015&end=2025&amount=10000&benchmark=SPY&base=USD",
    )
  })

  test("แปลงไปกลับได้ค่าเดิมเสมอ", () => {
    const config = {
      assets: [
        { symbol: "VTI", weight: "48" },
        { symbol: "VNQ", weight: "8" },
        { symbol: "VXUS", weight: "24" },
        { symbol: "BND", weight: "20" },
      ],
      startYear: 2012,
      endYear: 2026,
      amount: 25_000,
      benchmark: "SPY",
      baseCurrency: "THB" as const,
    }

    const result = decodeConfig(params(encodeConfig(config)), LAST_CLOSED_YEAR)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.config).toEqual(config)
  })

  test("แถวที่ยังไม่กรอกสัญลักษณ์ไม่ถูกเขียนลงลิงก์", () => {
    const encoded = encodeConfig({
      assets: [
        { symbol: "VTI", weight: "100" },
        { symbol: "", weight: "" },
      ],
      baseCurrency: "USD",
      startYear: 2020,
      endYear: 2026,
      amount: 10_000,
      benchmark: "SPY",
    })

    expect(encoded).toContain("assets=VTI:100&")
  })

  test("BR-URL-09 ลิงก์มีเฉพาะค่าที่ใช้คำนวณ", () => {
    const encoded = encodeConfig(defaultConfig(LAST_CLOSED_YEAR))
    const keys = [...new URLSearchParams(encoded).keys()].sort()

    expect(keys).toEqual(["amount", "assets", "base", "benchmark", "end", "start"])
  })
})
