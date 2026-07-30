import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-08 + US-09 — เดิน route จริง กดทุกตัวควบคุมที่การ์ดพูดถึง
 * และพิสูจน์ว่าตัวเลขในกราฟตรงกับตัวเลขในตารางสรุปที่ชั้นคำนวณยืนยันไว้แล้ว
 */
const EVIDENCE = "artifacts/evidence/S6"
const REFERENCE_LINK =
  "/backtest?assets=VTI:48,VNQ:8,VXUS:24,BND:20&start=2012&end=2026&amount=10000&benchmark=SPY"

const growthChart = (page: Page) => page.getByTestId("growth-chart")
const scaleButton = (page: Page) => page.getByRole("button", { name: /สเกล/ })

async function openReference(page: Page) {
  await page.goto(REFERENCE_LINK)
  await expect(growthChart(page)).toBeVisible({ timeout: 15_000 })
}

test.describe("US-08 เส้นมูลค่าพอร์ต", () => {
  test("AC-GRW-01 กราฟแสดงสองเส้น พอร์ตและตัวเทียบ", async ({ page }) => {
    await openReference(page)
    await expect(page.getByRole("heading", { name: "เส้นมูลค่าพอร์ต" })).toBeVisible()
    await expect(growthChart(page).locator(".recharts-line")).toHaveCount(2)
  })

  test("AC-GRW-02 มูลค่าในตารางประกอบตรงกับตารางสรุป", async ({ page }) => {
    await openReference(page)
    const endBalance = await page.getByTestId("portfolio-endBalance").textContent()

    await page.getByRole("group").filter({ hasText: "ดูเป็นตาราง" }).locator("summary").click()
    // ปีสุดท้ายของตารางสิ้นปี ต้องเป็นค่าเดียวกับมูลค่าสุดท้ายในตารางสรุป
    await expect(page.getByTestId("year-end-2026")).toHaveText(endBalance!.trim())
  })

  test("AC-GRW-03 ตารางประกอบมีครบทุกปีและเปิดด้วยแป้นพิมพ์ได้", async ({ page }) => {
    await openReference(page)
    await page.getByRole("group").filter({ hasText: "ดูเป็นตาราง" }).locator("summary").focus()
    await page.keyboard.press("Enter")
    await expect(page.getByTestId("growth-year-end").locator("tr")).toHaveCount(15)
    await expect(page.getByTestId("year-end-2012")).toHaveText("$11,436")
  })

  test("AC-GRW-04 สลับสเกลลอการิทึมได้และกลับได้", async ({ page }) => {
    await openReference(page)
    const button = scaleButton(page)
    await expect(button).toHaveAttribute("aria-pressed", "false")
    await expect(button).toHaveText("สเกลปกติ")

    await button.click()
    await expect(button).toHaveAttribute("aria-pressed", "true")
    await expect(button).toHaveText("สเกลลอการิทึม")
    await expect(growthChart(page).locator(".recharts-line")).toHaveCount(2)

    await button.click()
    await expect(button).toHaveAttribute("aria-pressed", "false")
  })

  test("EC-GRW ช่วงที่ถูกย่อ กราฟครอบเฉพาะช่วงที่ใช้จริง", async ({ page }) => {
    await page.goto("/backtest?assets=NEWFUND:50,VTI:50&start=2012&end=2026&benchmark=SPY")
    await expect(growthChart(page)).toBeVisible({ timeout: 15_000 })
    await page.getByRole("group").filter({ hasText: "ดูเป็นตาราง" }).locator("summary").click()

    const rows = page.getByTestId("growth-year-end").locator("tr")
    await expect(rows.first()).toContainText("2020")
    await expect(page.getByTestId("year-end-2012")).toHaveCount(0)
  })
})

test.describe("US-09 ผลตอบแทนรายปี", () => {
  test("AC-ANN-01 กราฟแท่งคู่ครบทุกปี", async ({ page }) => {
    await openReference(page)
    await expect(page.getByRole("heading", { name: "ผลตอบแทนรายปี" })).toBeVisible()
    // 15 ปี × 2 ชุดข้อมูล
    await expect(page.getByTestId("annual-chart").locator(".recharts-bar-rectangle")).toHaveCount(30)
  })

  test("AC-ANN-02 ตารางรายปีแสดงเสมอ และตรงกับปีดีสุด/แย่สุดในตารางสรุป", async ({ page }) => {
    await openReference(page)
    await expect(page.getByTestId("annual-table").locator("tr")).toHaveCount(15)
    await expect(page.getByTestId("annual-2019")).toHaveText("24.02%")
    await expect(page.getByTestId("annual-2022")).toHaveText("-17.95%")

    // ค่าเดียวกับที่ตารางสรุปรายงานเป็นปีที่ดีที่สุดและแย่ที่สุด (BR-ANN-05)
    await expect(page.getByTestId("portfolio-bestYear")).toContainText("24.02%")
    await expect(page.getByTestId("portfolio-worstYear")).toContainText("-17.95%")
  })

  test("AC-ANN-03 ปีที่ข้อมูลไม่ครบมีคำกำกับ", async ({ page }) => {
    await openReference(page)
    const partialRow = page.getByTestId("annual-table").locator("tr", { hasText: "2026" })
    await expect(partialRow).toContainText("ข้อมูล 6 เดือน")

    const fullRow = page.getByTestId("annual-table").locator("tr", { hasText: "2019" })
    await expect(fullRow).not.toContainText("ข้อมูล")
  })
})

test.describe("กราฟในสภาพแวดล้อมจริง", () => {
  test("โหมดมืดและจอแคบ", async ({ page, browser }) => {
    await openReference(page)
    await page.screenshot({ path: `${EVIDENCE}/charts-light.png`, fullPage: true })

    await page.getByRole("button", { name: "สลับโหมดสว่างและมืด" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.screenshot({ path: `${EVIDENCE}/charts-dark.png`, fullPage: true })

    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto(REFERENCE_LINK)
    await expect(growthChart(mobilePage)).toBeVisible({ timeout: 15_000 })

    const overflow = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, "หน้าเว็บต้องไม่เลื่อนแนวนอนบนจอแคบ").toBeLessThanOrEqual(0)
    await mobilePage.screenshot({ path: `${EVIDENCE}/charts-mobile.png`, fullPage: true })
    await mobile.close()
  })
})
