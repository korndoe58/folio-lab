import { describe, expect, it } from "vitest"
import { formatDuration } from "./format"

describe("formatDuration (BR-DDW-07)", () => {
  const labels = {
    year: (n: number) => `${n} ปี`,
    month: (n: number) => `${n} เดือน`,
  }

  it("น้อยกว่า 12 เดือน แสดงเป็นเดือนอย่างเดียว", () => {
    expect(formatDuration(3, labels)).toBe("3 เดือน")
    expect(formatDuration(11, labels)).toBe("11 เดือน")
  })

  it("ครบปีพอดี แสดงเป็นปีอย่างเดียว", () => {
    expect(formatDuration(12, labels)).toBe("1 ปี")
    expect(formatDuration(24, labels)).toBe("2 ปี")
  })

  it("เกินปี แสดงปีควบคู่เดือน", () => {
    expect(formatDuration(18, labels)).toBe("1 ปี 6 เดือน")
    expect(formatDuration(27, labels)).toBe("2 ปี 3 เดือน")
  })

  it("ศูนย์เดือน แสดงตามจริง ไม่ใช่ค่าว่าง", () => {
    expect(formatDuration(0, labels)).toBe("0 เดือน")
  })
})
