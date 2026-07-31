import { describe, expect, test } from "vitest"
import type { BacktestConfig, PortfolioRow } from "@/types/backtest"
import { evenWeights, hasIssues, retainIssues, validateConfig, weightSum } from "./validation"
import { makePortfolio } from "./url"

const LAST_CLOSED_YEAR = 2026

/** `assets` เป็นทางลัดของพอร์ตเดียว ส่วน `portfolios` ใช้ตอนทดสอบการเทียบหลายพอร์ต */
type ConfigOverrides = Partial<Omit<BacktestConfig, "portfolios">> & {
  assets?: PortfolioRow[]
  portfolios?: BacktestConfig["portfolios"]
}

const config = ({ assets, portfolios, ...overrides }: ConfigOverrides = {}): BacktestConfig => ({
  portfolios: portfolios ?? [
    makePortfolio({
      assets: assets ?? [
        { symbol: "VTI", weight: "60" },
        { symbol: "BND", weight: "40" },
      ],
    }),
  ],
  startYear: 2015,
  endYear: 2025,
  amount: 10_000,
  benchmark: "SPY",
  baseCurrency: "USD",
  inflationAdjusted: false,
  ...overrides,
})

/** ปัญหาระดับพอร์ตของพอร์ตแรก — ที่อยู่ใหม่ของ V-001 และ V-002 (BR-CMP-18) */
const firstPortfolio = (issues: ReturnType<typeof check>) => issues.portfolios[0]

const check = (c: BacktestConfig, unknownSymbols?: Set<string>) =>
  validateConfig(c, { lastClosedYear: LAST_CLOSED_YEAR, unknownSymbols })

describe("US-05 การตรวจฟอร์ม", () => {
  test("AC-CFG-02 ฟอร์มที่ถูกต้องไม่มีข้อผิดพลาด", () => {
    expect(hasIssues(check(config()))).toBe(false)
  })

  test("AC-CFG-03 น้ำหนักรวมไม่เท่ากับ 100 แจ้ง V-001 พร้อมผลรวมจริง", () => {
    const issues = check(config({ assets: [
      { symbol: "VTI", weight: "60" },
      { symbol: "BND", weight: "30" },
    ] }))

    expect(firstPortfolio(issues).portfolio).toEqual({ code: "V-001", params: { sum: "90" } })
  })

  test("AC-CFG-04 ยังไม่กรอกสัญลักษณ์เลย แจ้ง V-002", () => {
    const issues = check(config({ assets: [{ symbol: "", weight: "" }] }))
    expect(firstPortfolio(issues).portfolio?.code).toBe("V-002")
  })

  test("AC-CFG-05 สัญลักษณ์ที่ไม่มีข้อมูล แจ้ง V-003 พร้อมชื่อ", () => {
    const issues = check(
      config({ assets: [{ symbol: "ZZZZZ", weight: "100" }] }),
      new Set(["ZZZZZ"]),
    )

    expect(firstPortfolio(issues).rows[0]).toEqual({ code: "V-003", params: { symbol: "ZZZZZ" } })
  })

  test("AC-CFG-06 ปีเริ่มต้นมากกว่าปีสิ้นสุด แจ้ง V-004", () => {
    expect(check(config({ startYear: 2020, endYear: 2015 })).endYear?.code).toBe("V-004")
  })

  test("ปีเริ่มต้นเท่ากับปีสิ้นสุดใช้ได้", () => {
    expect(check(config({ startYear: 2020, endYear: 2020 })).endYear).toBeNull()
  })

  test("AC-CFG-07 ปีสิ้นสุดเกินเดือนที่มีข้อมูล แจ้ง V-005", () => {
    expect(check(config({ endYear: 2030 })).endYear?.code).toBe("V-005")
  })

  test("AC-CFG-08 เงินตั้งต้นไม่ถูกต้อง แจ้ง V-006", () => {
    expect(check(config({ amount: 0 })).amount?.code).toBe("V-006")
    expect(check(config({ amount: -100 })).amount?.code).toBe("V-006")
    expect(check(config({ amount: 2_000_000_000 })).amount?.code).toBe("V-006")
    expect(check(config({ amount: 10_000 })).amount).toBeNull()
  })

  test("AC-CFG-09 + EC-CFG-03 น้ำหนักนอกช่วงหรือไม่ใช่ตัวเลข แจ้ง V-007", () => {
    const outOfRange = check(config({ assets: [{ symbol: "VTI", weight: "150" }] }))
    expect(outOfRange.portfolios[0].rows[0]?.code).toBe("V-007")

    const notANumber = check(config({ assets: [{ symbol: "VTI", weight: "abc" }] }))
    expect(notANumber.portfolios[0].rows[0]?.code).toBe("V-007")

    const blank = check(config({ assets: [{ symbol: "VTI", weight: "   " }] }))
    expect(blank.portfolios[0].rows[0]?.code, "ช่องว่างล้วนต้องไม่ถือเป็นศูนย์เงียบ ๆ").toBe("V-007")
  })

  test("AC-CFG-10 สัญลักษณ์ซ้ำในพอร์ตเดียว แจ้ง V-010", () => {
    const issues = check(config({ assets: [
      { symbol: "VTI", weight: "50" },
      { symbol: "vti", weight: "50" },
    ] }))

    expect(firstPortfolio(issues).rows[1]?.code).toBe("V-010")
  })

  test("EC-CFG-01 น้ำหนักรวม 99.99 หรือ 100.01 ยังผ่านตามความคลาดที่ยอมรับ", () => {
    const three = check(config({ assets: [
      { symbol: "A", weight: "33.34" },
      { symbol: "B", weight: "33.33" },
      { symbol: "C", weight: "33.33" },
    ] }))
    expect(three.portfolios[0].portfolio).toBeNull()

    const under = check(config({ assets: [
      { symbol: "A", weight: "33.33" },
      { symbol: "B", weight: "33.33" },
      { symbol: "C", weight: "33.33" },
    ] }))
    expect(under.portfolios[0].portfolio).toBeNull()
  })

  test("EC-CFG-07 สัญลักษณ์ตัวพิมพ์เล็กใช้ได้", () => {
    expect(hasIssues(check(config({ assets: [{ symbol: "vti", weight: "100" }] })))).toBe(false)
  })

  test("สัญลักษณ์ผิดรูปแบบแจ้ง V-003", () => {
    expect(check(config({ assets: [{ symbol: "VT I", weight: "100" }] })).portfolios[0].rows[0]?.code).toBe("V-003")
    expect(check(config({ assets: [{ symbol: "1ABC", weight: "100" }] })).portfolios[0].rows[0]?.code).toBe("V-003")
  })

  test("ตัวเทียบที่ไม่มีข้อมูลแจ้ง V-003 ที่ช่องตัวเทียบ", () => {
    const issues = check(config({ benchmark: "NOPE" }), new Set(["NOPE"]))
    expect(issues.benchmark?.code).toBe("V-003")
  })

  test("แถวว่างที่ยังไม่กรอกไม่ถือว่าผิด", () => {
    const issues = check(config({ assets: [
      { symbol: "VTI", weight: "100" },
      { symbol: "", weight: "" },
    ] }))

    expect(firstPortfolio(issues).rows[1]).toBeNull()
    expect(firstPortfolio(issues).portfolio).toBeNull()
  })
})

describe("US-16 การตรวจฟอร์มหลายพอร์ต", () => {
  const named = (name: string, assets: PortfolioRow[]) => makePortfolio({ name, assets })

  test("AC-CMP-06 ข้อความชี้ไปที่พอร์ตที่ผิดจริง พอร์ตอื่นไม่ขึ้นข้อความ", () => {
    const issues = check(
      config({
        portfolios: [
          named("", [{ symbol: "VTI", weight: "100" }]),
          named("", [
            { symbol: "VTI", weight: "60" },
            { symbol: "BND", weight: "30" },
          ]),
        ],
      }),
    )

    expect(issues.portfolios[0].portfolio).toBeNull()
    expect(issues.portfolios[1].portfolio).toEqual({ code: "V-001", params: { sum: "90" } })
  })

  test("BR-CMP-19 สัญลักษณ์เดียวกันข้ามพอร์ตไม่ผิด แต่ซ้ำในพอร์ตเดียวกันผิด", () => {
    const acrossPortfolios = check(
      config({
        portfolios: [
          named("", [{ symbol: "VTI", weight: "100" }]),
          named("", [{ symbol: "VTI", weight: "100" }]),
        ],
      }),
    )
    expect(hasIssues(acrossPortfolios)).toBe(false)

    const withinOne = check(
      config({
        portfolios: [
          named("", [
            { symbol: "VTI", weight: "50" },
            { symbol: "VTI", weight: "50" },
          ]),
        ],
      }),
    )
    expect(withinOne.portfolios[0].rows[1]?.code).toBe("V-010")
  })

  test("AC-CMP-07 ชื่อพอร์ตซ้ำแจ้ง V-013 ทุกพอร์ตที่ใช้ชื่อนั้น", () => {
    const issues = check(
      config({
        portfolios: [
          named("ทดลอง", [{ symbol: "VTI", weight: "100" }]),
          named(" ทดลอง ", [{ symbol: "BND", weight: "100" }]),
          named("อีกอัน", [{ symbol: "SPY", weight: "100" }]),
        ],
      }),
    )

    expect(issues.portfolios[0].portfolio?.code).toBe("V-013")
    expect(issues.portfolios[1].portfolio?.code).toBe("V-013")
    expect(issues.portfolios[2].portfolio).toBeNull()
  })

  test("BR-CMP-17 ชื่อที่ต่างกันแค่ตัวพิมพ์ถือว่าซ้ำ ส่วนชื่อว่างไม่นับ", () => {
    const sameLetters = check(
      config({
        portfolios: [
          named("Growth", [{ symbol: "VTI", weight: "100" }]),
          named("growth", [{ symbol: "BND", weight: "100" }]),
        ],
      }),
    )
    expect(sameLetters.portfolios[0].portfolio?.code).toBe("V-013")

    const bothBlank = check(
      config({
        portfolios: [
          named("", [{ symbol: "VTI", weight: "100" }]),
          named("", [{ symbol: "BND", weight: "100" }]),
        ],
      }),
    )
    expect(hasIssues(bothBlank)).toBe(false)
  })

  test("BR-CMP-18 พอร์ตที่ยังไม่กรอกสินทรัพย์แจ้ง V-002 เฉพาะพอร์ตนั้น", () => {
    const issues = check(
      config({
        portfolios: [
          named("", [{ symbol: "VTI", weight: "100" }]),
          named("", [{ symbol: "", weight: "" }]),
        ],
      }),
    )

    expect(issues.portfolios[0].portfolio).toBeNull()
    expect(issues.portfolios[1].portfolio?.code).toBe("V-002")
  })
})

describe("US-05 ตัวช่วยของฟอร์ม", () => {
  test("AC-CFG-11 เฉลี่ยน้ำหนักเท่ากันแล้วรวมได้ 100 พอดี", () => {
    expect(evenWeights(3)).toEqual(["33.34", "33.33", "33.33"])
    expect(evenWeights(2)).toEqual(["50", "50"])
    expect(evenWeights(4)).toEqual(["25", "25", "25", "25"])

    for (const count of [1, 3, 6, 7, 9]) {
      const total = evenWeights(count).reduce((sum, w) => sum + Number(w), 0)
      expect(Math.abs(total - 100), `${count} แถวต้องรวมได้ 100`).toBeLessThanOrEqual(0.01)
    }
  })

  test("ผลรวมนับเฉพาะแถวที่กรอกสัญลักษณ์แล้ว", () => {
    expect(
      weightSum([
        { symbol: "VTI", weight: "60" },
        { symbol: "", weight: "999" },
      ]),
    ).toBe(60)
  })
})

describe("US-18 + US-19 การตรวจเงินเข้าออกและการปรับสมดุล", () => {
  const withCashflow = (overrides: Partial<NonNullable<BacktestConfig["portfolios"][0]["cashflow"]>>) =>
    config({
      portfolios: [
        makePortfolio({
          assets: [{ symbol: "VTI", weight: "100" }],
          cashflow: {
            direction: "deposit",
            amount: "200",
            basis: "fixed",
            frequency: "monthly",
            inflationAdjusted: false,
            allocation: "prorata",
            ...overrides,
          },
        }),
      ],
    })

  test("AC-CMP-29 จำนวนต่องวดต้องมากกว่า 0 แจ้ง V-011", () => {
    expect(check(withCashflow({ amount: "0" })).portfolios[0].portfolio?.code).toBe("V-011")
    expect(check(withCashflow({ amount: "" })).portfolios[0].portfolio?.code).toBe("V-011")
    expect(check(withCashflow({ amount: "-50" })).portfolios[0].portfolio?.code).toBe("V-011")
    expect(check(withCashflow({ amount: "200" })).portfolios[0].portfolio).toBeNull()
  })

  test("AC-CMP-30 ถอนเป็นเปอร์เซ็นต์ต้องอยู่ระหว่าง 0 ถึง 100 แจ้ง V-014", () => {
    const percent = (amount: string) =>
      check(withCashflow({ direction: "withdraw", basis: "percent", amount }))

    expect(percent("120").portfolios[0].portfolio?.code).toBe("V-014")
    expect(percent("0").portfolios[0].portfolio?.code).toBe("V-014")
    expect(percent("100").portfolios[0].portfolio).toBeNull()
    expect(percent("4").portfolios[0].portfolio).toBeNull()
  })

  test("AC-CMP-39 เกณฑ์การเบี่ยงเบนต้องอยู่ระหว่าง 1 ถึง 50 แจ้ง V-012", () => {
    const band = (bandPoints: string) =>
      check(
        config({
          portfolios: [
            makePortfolio({
              assets: [{ symbol: "VTI", weight: "100" }],
              rebalance: "bands",
              bandPoints,
            }),
          ],
        }),
      )

    expect(band("80").portfolios[0].portfolio?.code).toBe("V-012")
    expect(band("0").portfolios[0].portfolio?.code).toBe("V-012")
    expect(band("5").portfolios[0].portfolio).toBeNull()
  })

  test("เกณฑ์การเบี่ยงเบนไม่ถูกตรวจเมื่อไม่ได้เลือกวิธีนั้น", () => {
    const issues = check(
      config({
        portfolios: [
          makePortfolio({
            assets: [{ symbol: "VTI", weight: "100" }],
            rebalance: "annual",
            bandPoints: "999",
          }),
        ],
      }),
    )
    expect(hasIssues(issues)).toBe(false)
  })
})

describe("US-27 จังหวะที่ข้อความตรวจสอบโผล่และหาย (PD-018)", () => {
  const seen = (c: BacktestConfig) => check(c)

  test("AC-FRM-14 ช่องที่แก้ถูกแล้ว ข้อความหายทันที", () => {
    const broken = seen(config({ assets: [{ symbol: "VTI", weight: "60" }] })) // รวมได้ 60
    expect(broken.portfolios[0].portfolio?.code).toBe("V-001")

    const fixed = seen(config({ assets: [{ symbol: "VTI", weight: "100" }] }))
    expect(retainIssues(broken, fixed).portfolios[0].portfolio).toBeNull()
  })

  test("AC-FRM-15 ช่องที่ยังไม่ถูก ข้อความอยู่ต่อพร้อมค่าล่าสุด", () => {
    const before = seen(config({ assets: [{ symbol: "VTI", weight: "60" }] }))
    const after = seen(config({ assets: [{ symbol: "VTI", weight: "70" }] }))
    const kept = retainIssues(before, after)

    expect(kept.portfolios[0].portfolio?.code).toBe("V-001")
    // ★ ข้อความต้องบอกผลรวมใหม่ ไม่ใช่เลขตอนกดรัน
    expect(before.portfolios[0].portfolio?.params?.sum).toBe("60")
    expect(kept.portfolios[0].portfolio?.params?.sum).toBe("70")
  })

  test("AC-FRM-16 ปัญหาที่เพิ่งเกิดระหว่างพิมพ์ ไม่ถูกเพิ่มเข้ามา", () => {
    // เดิมผิดที่น้ำหนักรวม ส่วนเงินตั้งต้นยังถูกอยู่
    const before = seen(config({ assets: [{ symbol: "VTI", weight: "60" }] }))
    expect(before.amount).toBeNull()

    // ผู้ใช้กำลังลบเงินตั้งต้นเพื่อพิมพ์ใหม่ — ผ่านสถานะที่ตรวจแล้วผิด
    const typing = seen(config({ assets: [{ symbol: "VTI", weight: "60" }], amount: 0 }))
    expect(typing.amount?.code).toBe("V-006")

    const kept = retainIssues(before, typing)
    expect(kept.amount, "ช่องที่ยังไม่เคยมีข้อความต้องเงียบต่อไป").toBeNull()
    expect(kept.portfolios[0].portfolio?.code, "ของเดิมที่ยังผิดยังอยู่").toBe("V-001")
  })

  test("EC-FRM-12 แก้ช่องหนึ่งถูกแต่อีกช่องยังผิด", () => {
    const before = seen(config({ assets: [{ symbol: "VTI", weight: "60" }], amount: 0 }))
    expect(before.portfolios[0].portfolio?.code).toBe("V-001")
    expect(before.amount?.code).toBe("V-006")

    const after = seen(config({ assets: [{ symbol: "VTI", weight: "100" }], amount: 0 }))
    const kept = retainIssues(before, after)

    expect(kept.portfolios[0].portfolio).toBeNull()
    expect(kept.amount?.code).toBe("V-006")
  })

  test("EC-FRM-10 เพิ่มแถวสินทรัพย์แล้วข้อความไม่เลื่อนไปผิดแถว", () => {
    // แถวแรกน้ำหนักผิดรูปแบบ
    const before = seen(config({ assets: [{ symbol: "VTI", weight: "abc" }] }))
    expect(before.portfolios[0].rows[0]?.code).toBe("V-007")

    // เพิ่มแถวว่างต่อท้าย
    const after = seen(
      config({ assets: [{ symbol: "VTI", weight: "abc" }, { symbol: "", weight: "" }] }),
    )
    const kept = retainIssues(before, after)

    expect(kept.portfolios[0].rows[0]?.code).toBe("V-007")
    expect(kept.portfolios[0].rows[1], "แถวใหม่ที่ยังว่างต้องเงียบ").toBeNull()
  })

  test("EC-FRM-09 ลบแถวที่มีปัญหาทิ้ง ข้อความหายไปกับแถว", () => {
    const before = seen(
      config({ assets: [{ symbol: "VTI", weight: "100" }, { symbol: "BND", weight: "abc" }] }),
    )
    expect(before.portfolios[0].rows[1]?.code).toBe("V-007")

    const after = seen(config({ assets: [{ symbol: "VTI", weight: "100" }] }))
    const kept = retainIssues(before, after)

    expect(kept.portfolios[0].rows).toHaveLength(1)
    expect(hasIssues(kept)).toBe(false)
  })

  test("EC-FRM-11 ลบพอร์ตทิ้ง พอร์ตที่เหลือไม่รับข้อความผิดพอร์ต", () => {
    const twoPortfolios = (weights: string[]) =>
      config({
        portfolios: weights.map((w) => makePortfolio({ assets: [{ symbol: "VTI", weight: w }] })),
      })

    // พอร์ตแรกถูก พอร์ตที่สองผิด
    const before = seen(twoPortfolios(["100", "60"]))
    expect(before.portfolios[0].portfolio).toBeNull()
    expect(before.portfolios[1].portfolio?.code).toBe("V-001")

    // ลบพอร์ตแรกทิ้ง เหลือพอร์ตที่ผิดกลายเป็นดัชนี 0
    const after = seen(twoPortfolios(["60"]))
    const kept = retainIssues(before, after)

    // ดัชนี 0 เดิมไม่มีปัญหา ข้อความจึงยังไม่โผล่จนกว่าจะกดรันใหม่ — ไม่ใช่ยกของพอร์ตอื่นมาใส่
    expect(kept.portfolios).toHaveLength(1)
    expect(kept.portfolios[0].portfolio).toBeNull()
  })

  test("BR-FRM-21 กฎการตรวจไม่เปลี่ยน — ตรวจครบเหมือนเดิมเสมอ", () => {
    const all = seen(config({ assets: [{ symbol: "VTI", weight: "60" }], amount: 0, endYear: 2099 }))
    expect(all.portfolios[0].portfolio?.code).toBe("V-001")
    expect(all.amount?.code).toBe("V-006")
    expect(all.endYear?.code).toBe("V-005")
  })
})
