import { describe, expect, it } from "vitest"
import { CONSENT_REQUIRED_REGIONS } from "./regions"

/**
 * รายชื่อเขตเป็นข้อที่ตาคนอ่านพลาดง่ายที่สุดของ US-38 — พิมพ์ผิดหนึ่งตัวแปลว่า
 * ผู้ใช้เขตนั้นถูกวางคุกกี้โดยไม่ได้ขอ และไม่มีอะไรบนหน้าจอฟ้องเลย
 *
 * **ชุดนี้พิสูจน์อะไรไม่ได้:** พิสูจน์ไม่ได้ว่าปลายทางบังคับใช้ตามรายชื่อนี้จริง —
 * ปลายทางตัดสินเขตจากที่อยู่เครือข่ายของผู้ใช้ ซึ่งอยู่นอกการควบคุมของเรา
 */
describe("รายชื่อเขตที่ต้องขอความยินยอมก่อน (BR-USE-21)", () => {
  it("มีครบ 32 เขต", () => {
    expect(CONSENT_REQUIRED_REGIONS).toHaveLength(32)
  })

  it("ไม่มีตัวซ้ำ", () => {
    expect(new Set(CONSENT_REQUIRED_REGIONS).size).toBe(CONSENT_REQUIRED_REGIONS.length)
  })

  it("ทุกตัวเป็นรหัสสองตัวอักษรพิมพ์ใหญ่", () => {
    for (const code of CONSENT_REQUIRED_REGIONS) expect(code).toMatch(/^[A-Z]{2}$/)
  })

  it("มีสหภาพยุโรปครบ 27 ประเทศ", () => {
    const eu = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"]
    expect(eu).toHaveLength(27)
    for (const code of eu) expect(CONSENT_REQUIRED_REGIONS, `ขาด ${code}`).toContain(code)
  })

  it("มีอีกห้าเขตนอกสหภาพยุโรปที่ใช้กฎเดียวกัน", () => {
    for (const code of ["IS", "LI", "NO", "GB", "CH"]) {
      expect(CONSENT_REQUIRED_REGIONS, `ขาด ${code}`).toContain(code)
    }
  })

  it("ไม่มีไทยและสหรัฐอยู่ในรายชื่อ — สองเขตหลักที่ต้องได้ข้อมูลจริง", () => {
    expect(CONSENT_REQUIRED_REGIONS).not.toContain("TH")
    expect(CONSENT_REQUIRED_REGIONS).not.toContain("US")
  })
})
