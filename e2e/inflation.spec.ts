import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-15 — ตัวเลือกปรับเงินเฟ้อบนหน้าจอจริง
 *
 * เทสต์ที่สำคัญที่สุดในไฟล์นี้คือ "ค่าความเสี่ยงต้องไม่ขยับ" เพราะเป็นความเสียหายที่มองไม่เห็น
 * ถ้าเผลอปรับเกินขอบเขต — ตัวเลขจะดูสมเหตุสมผลทั้งที่ผิดนิยาม (BR-INF-08)
 */
const EVIDENCE = "artifacts/evidence/S13"
/** พอร์ตอ้างอิงเดียวกับ golden test — ครอบถึงปี 2026 ที่ยังไม่มีดัชนี จึงได้เดินเส้นทาง N-003 ด้วย */
const REFERENCE = "assets=VTI:48,VNQ:8,VXUS:24,BND:20&start=2012&end=2026&amount=10000&benchmark=SPY&base=USD"
/** ช่วงที่มีดัชนีครบทุกปี ใช้ยืนยันว่า N-003 ไม่ขึ้นพร่ำเพรื่อ */
const COVERED = "assets=VTI:100&start=2015&end=2025&amount=10000&benchmark=SPY&base=USD"
/** ลิงก์รูปแบบเดียวกับที่บันทึกไว้ในหลักฐานของ S8 — ไม่มีทั้งสกุลเงินและตัวเลือกนี้ */
const LEGACY_LINK = "/backtest?assets=VTI:60,BND:40&start=2015&end=2025&amount=10000&benchmark=SPY"

const ADJUSTED = ["endBalance", "cagr", "bestYear", "worstYear"] as const
const UNTOUCHED = ["stdev", "maxDrawdown", "sharpe", "sortino"] as const

const ready = (page: Page) => page.getByTestId("portfolio-endBalance")
const toggle = (page: Page) => page.getByRole("checkbox", { name: "หักเงินเฟ้อออกจากผลตอบแทน" })
const gapNotice = (page: Page) => page.getByText("ยังไม่มีอัตราเงินเฟ้อประกาศ", { exact: false })
const nominalNote = (page: Page) => page.getByText("เส้นนี้ยังเป็นมูลค่าตามตัวเงิน", { exact: false })

/** ค่าที่แสดงของทุกแถว — ตัดบรรทัดปีและบรรทัดเทียบทิศออก เหลือเฉพาะตัวเลข */
async function readRows(page: Page): Promise<Record<string, string>> {
  const metrics = [...ADJUSTED, ...UNTOUCHED, "startAmount"]
  const entries = await Promise.all(
    metrics.map(async (metric) => {
      const text = (await page.getByTestId(`portfolio-${metric}`).textContent()) ?? ""
      return [metric, text.trim().split("\n")[0].trim()] as const
    }),
  )
  return Object.fromEntries(entries)
}

test.describe("US-15 ตัวเลือกปรับเงินเฟ้อ", () => {
  test("AC-INF-01 ฟอร์มเปล่ามีตัวเลือก และเริ่มที่ปิด", async ({ page }) => {
    await page.goto("/backtest")

    await expect(toggle(page)).toBeVisible()
    await expect(toggle(page)).not.toBeChecked()
    // คำอธิบายต้องผูกกับตัวเลือกจริง ไม่ใช่ลอยอยู่ข้าง ๆ (BR-INF-11)
    await expect(toggle(page)).toHaveAccessibleDescription(/เงินเฟ้อของไทยเสมอ/)
  })

  test("AC-INF-03/04 เปิดแล้วค่าที่ควรเปลี่ยนเปลี่ยน ค่าความเสี่ยงไม่ขยับสักหลัก", async ({ page }) => {
    await page.goto(`/backtest?${REFERENCE}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    const before = await readRows(page)

    await toggle(page).check()
    await page.getByRole("button", { name: "เริ่มทดสอบ", exact: true }).click()
    await expect(page.getByTestId("adjusted-cagr")).toBeVisible({ timeout: 30_000 })
    const after = await readRows(page)

    for (const metric of ADJUSTED) {
      expect(after[metric], `แถว ${metric} ต้องเปลี่ยน`).not.toBe(before[metric])
      await expect(page.getByTestId(`adjusted-${metric}`)).toBeVisible()
    }
    for (const metric of UNTOUCHED) {
      expect(after[metric], `แถว ${metric} ต้องเท่าเดิมทุกหลัก`).toBe(before[metric])
      await expect(page.getByTestId(`adjusted-${metric}`)).toHaveCount(0)
    }
    // เงินตั้งต้นคือเงินที่ใส่จริง ไม่ใช่ค่าที่คำนวณ จึงไม่ถูกปรับ
    expect(after.startAmount).toBe(before.startAmount)
    await expect(page.getByTestId("adjusted-startAmount")).toHaveCount(0)

    await expect(page).toHaveURL(/real=1/)
    await page.screenshot({ path: `${EVIDENCE}/reference-real.png`, fullPage: true })
  })

  test("AC-INF-03 ค่าที่ปรับแล้วตรงกับที่คำนวณมือ", async ({ page }) => {
    await page.goto(`/backtest?${REFERENCE}&real=1`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    // ตัวคูณเงินเฟ้อสะสมของช่วงนี้คือ 1.1791 (ปี 2026 ยังไม่มีดัชนี จึงคูณด้วย 1)
    // 41,495 ÷ 1.1791 = 35,193 · (35,193 ÷ 10,000)^(12÷174) − 1 = 9.07%
    await expect(ready(page)).toHaveText("$35,193")
    await expect(page.getByTestId("portfolio-cagr")).toContainText("9.07%")

    // ปี 2022 เงินเฟ้อ 6.08%: (1 − 0.1795) ÷ 1.0608 − 1 = −22.65%
    await expect(page.getByTestId("portfolio-worstYear")).toContainText("-22.65%")
    // ปี 2019 เงินเฟ้อ 0.71%: 1.2402 ÷ 1.0071 − 1 = 23.15%
    await expect(page.getByTestId("portfolio-bestYear")).toContainText("23.15%")
  })

  test("BR-ANN-05 ตารางรายปีใช้ค่าชุดเดียวกับตารางสรุป", async ({ page }) => {
    await page.goto(`/backtest?${REFERENCE}&real=1`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(page.getByRole("heading", { name: "ผลตอบแทนรายปี หลังหักเงินเฟ้อ" })).toBeVisible()
    await expect(page.getByTestId("annual-2022")).toHaveText("-22.65%")
    await expect(page.getByTestId("annual-2019")).toHaveText("23.15%")
  })

  test("AC-INF-05 กราฟมูลค่าบอกว่ายังเป็นตัวเงินปกติ เฉพาะตอนเปิด", async ({ page }) => {
    await page.goto(`/backtest?${REFERENCE}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(nominalNote(page)).toHaveCount(0)

    await page.goto(`/backtest?${REFERENCE}&real=1`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(nominalNote(page)).toBeVisible()
  })

  test("AC-INF-06 ปีที่ยังไม่มีดัชนีถูกแจ้ง และผลที่เหลือยังครบ (N-003)", async ({ page }) => {
    await page.goto(`/backtest?${REFERENCE}&real=1`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(gapNotice(page)).toBeVisible()
    await expect(gapNotice(page)).toContainText("2026")
    await expect(page.getByTestId("summary-rows").locator("tr")).toHaveCount(9)

    // ช่วงที่มีดัชนีครบต้องไม่ขึ้นข้อความนี้
    await page.goto(`/backtest?${COVERED}&real=1`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(gapNotice(page)).toHaveCount(0)
  })

  test("AC-INF-10 ปิดกลับแล้วได้ค่าเดิมทุกหลัก", async ({ page }) => {
    await page.goto(`/backtest?${REFERENCE}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    const original = await readRows(page)

    await toggle(page).check()
    await page.getByRole("button", { name: "เริ่มทดสอบ", exact: true }).click()
    await expect(page.getByTestId("adjusted-cagr")).toBeVisible({ timeout: 30_000 })

    await toggle(page).uncheck()
    await page.getByRole("button", { name: "เริ่มทดสอบ", exact: true }).click()
    await expect(page.getByTestId("adjusted-cagr")).toHaveCount(0)

    expect(await readRows(page)).toEqual(original)
    await expect(nominalNote(page)).toHaveCount(0)
    await expect(gapNotice(page)).toHaveCount(0)
  })

  test("AC-INF-08 ลิงก์เก่าที่ไม่มีตัวเลือกนี้ ให้ค่าเดิมทุกหลัก", async ({ page }) => {
    await page.goto(LEGACY_LINK)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    // ค่าที่บันทึกไว้ในหลักฐานของ S8 ก่อนมีทั้งสกุลเงินและการปรับเงินเฟ้อ
    await expect(page.getByTestId("portfolio-cagr")).toHaveText("8.64%")
    await expect(ready(page)).toHaveText("$24,884")
    await expect(toggle(page)).not.toBeChecked()
  })

  test("AC-INF-09 สลับสกุลเงินแล้วยังใช้เงินเฟ้อไทยชุดเดิม", async ({ page }) => {
    // ผลตอบแทนรายปีของ VTI ในสกุลบาทกับดอลลาร์ต่างกัน แต่ตัวหารต้องเป็นเงินเฟ้อไทยทั้งคู่
    const ratioOf = async (base: string) => {
      await page.goto(`/backtest?assets=VTI:100&start=2015&end=2025&amount=10000&benchmark=SPY&base=${base}`)
      await expect(ready(page)).toBeVisible({ timeout: 30_000 })
      const nominal = await page.getByTestId("portfolio-worstYear").textContent()

      await page.goto(`/backtest?assets=VTI:100&start=2015&end=2025&amount=10000&benchmark=SPY&base=${base}&real=1`)
      await expect(ready(page)).toBeVisible({ timeout: 30_000 })
      const real = await page.getByTestId("portfolio-worstYear").textContent()

      const toNumber = (text: string | null) => Number((text ?? "").replace(/[^0-9.-]/g, "")) / 100
      return (1 + toNumber(real)) / (1 + toNumber(nominal))
    }

    // ทั้งสองฐานต้องถูกหารด้วยตัวเลขเดียวกัน = 1 ÷ (1 + เงินเฟ้อไทยของปีนั้น)
    expect(await ratioOf("USD")).toBeCloseTo(await ratioOf("THB"), 3)
  })
})

test.describe("ปรับเงินเฟ้อในสภาพแวดล้อมจริง", () => {
  test("เดินด้วยแป้นพิมพ์ได้ทั้งเปิดและปิด", async ({ page }) => {
    await page.goto("/backtest")

    await toggle(page).focus()
    await expect(toggle(page)).toBeFocused()
    await page.keyboard.press("Space")
    await expect(toggle(page)).toBeChecked()
    await page.keyboard.press("Space")
    await expect(toggle(page)).not.toBeChecked()
  })

  test("โหมดมืดและจอแคบ", async ({ page, browser }) => {
    await page.goto(`/backtest?${REFERENCE}&real=1`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await page.screenshot({ path: `${EVIDENCE}/real-light.png`, fullPage: true })

    await page.getByRole("button", { name: "สลับโหมดสว่างและมืด" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await expect(page.getByTestId("adjusted-cagr")).toBeVisible()
    await page.screenshot({ path: `${EVIDENCE}/real-dark.png`, fullPage: true })

    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto(`/backtest?${REFERENCE}&real=1`)
    await expect(mobilePage.getByTestId("portfolio-endBalance")).toBeVisible({ timeout: 30_000 })

    const overflow = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, "หน้าเว็บต้องไม่เลื่อนแนวนอนบนจอแคบ").toBeLessThanOrEqual(0)
    await mobilePage.screenshot({ path: `${EVIDENCE}/real-mobile.png`, fullPage: true })
    await mobile.close()
  })

  test("สลับภาษาแล้วคำกำกับเปลี่ยนตาม", async ({ page }) => {
    await page.goto(`/backtest?${REFERENCE}&real=1`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()
    await expect(page.getByTestId("adjusted-cagr")).toHaveText("after inflation")
    await expect(page.getByRole("heading", { name: "Annual returns after inflation" })).toBeVisible()
  })
})
