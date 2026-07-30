import { expect, test } from "@playwright/test"

/**
 * R10 walk ของ US-07 — ตัวเลขบนจอต้องตรงกับที่ชุดทดสอบของชั้นคำนวณยืนยันไว้
 */
const EVIDENCE = "artifacts/evidence/S5"
const REFERENCE_LINK =
  "/backtest?assets=VTI:48,VNQ:8,VXUS:24,BND:20&start=2012&end=2026&amount=10000&benchmark=SPY"

test.describe("US-07 ตารางสรุปผล", () => {
  test("AC-SUM-01/02 ค่าบนจอตรงกับที่ชั้นคำนวณยืนยัน ทั้งพอร์ตและตัวเทียบ", async ({ page }) => {
    await page.goto(REFERENCE_LINK)
    await expect(page.getByRole("heading", { name: "สรุปผลการทดสอบ" })).toBeVisible({
      timeout: 15_000,
    })

    const expected = {
      endBalance: ["$41,495", "$76,589"],
      cagr: ["10.31%", "15.07%"],
      stdev: ["11.42%", "14.04%"],
      maxDrawdown: ["-23.55%", "-23.93%"],
      sharpe: ["0.78", "0.96"],
      sortino: ["1.19", "1.55"],
    }

    for (const [metric, [portfolio, benchmark]] of Object.entries(expected)) {
      await expect(page.getByTestId(`portfolio-${metric}`), `พอร์ต ${metric}`).toHaveText(portfolio)
      await expect(page.getByTestId(`benchmark-${metric}`), `ตัวเทียบ ${metric}`).toHaveText(
        benchmark,
      )
    }

    await expect(page.getByTestId("portfolio-startAmount")).toHaveText("$10,000")
    await page.screenshot({ path: `${EVIDENCE}/summary-light.png`, fullPage: true })
  })

  test("AC-SUM-04 ปีที่ดีที่สุดและแย่ที่สุดพร้อมปีกำกับ", async ({ page }) => {
    await page.goto(REFERENCE_LINK)
    await expect(page.getByTestId("portfolio-bestYear")).toHaveText("24.02%", { timeout: 15_000 })
    await expect(page.getByTestId("portfolio-worstYear")).toHaveText("-17.95%")
    await expect(page.getByText("(2019)").first()).toBeVisible()
    await expect(page.getByText("(2022)").first()).toBeVisible()
  })

  test("BR-SUM-02 แถวครบ 9 แถวเรียงตามลำดับที่กำหนด", async ({ page }) => {
    await page.goto(REFERENCE_LINK)
    await expect(page.getByRole("heading", { name: "สรุปผลการทดสอบ" })).toBeVisible({
      timeout: 15_000,
    })

    const labels = await page.locator("tbody tr th").allInnerTexts()
    expect(labels.map((l) => l.trim())).toEqual([
      "เงินตั้งต้น",
      "มูลค่าสุดท้าย",
      "ผลตอบแทนต่อปีแบบทบต้น",
      "ความผันผวนต่อปี",
      "ปีที่ดีที่สุด",
      "ปีที่แย่ที่สุด",
      "ช่วงขาดทุนสูงสุด",
      "Sharpe",
      "Sortino",
    ])
  })

  test("BR-SUM-07 การเทียบกับตลาดอ่านได้เป็นข้อความ ไม่พึ่งสีอย่างเดียว", async ({ page }) => {
    await page.goto(REFERENCE_LINK)
    await expect(page.getByRole("heading", { name: "สรุปผลการทดสอบ" })).toBeVisible({
      timeout: 15_000,
    })

    // พอร์ตนี้ผลตอบแทนต่ำกว่าตลาด แต่ผันผวนน้อยกว่าและขาดทุนตื้นกว่า
    await expect(page.getByText("ต่ำกว่าตลาด").first()).toBeVisible()
    await expect(page.getByText("ดีกว่าตลาด").first()).toBeVisible()
  })

  test("AC-SUM-03 เปิดคำอธิบายศัพท์ด้วยแป้นพิมพ์ได้", async ({ page }) => {
    await page.goto(REFERENCE_LINK)
    await expect(page.getByRole("heading", { name: "สรุปผลการทดสอบ" })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole("button", { name: "ดูคำอธิบายของ Sharpe" }).focus()
    await expect(
      page.getByText("ผลตอบแทนส่วนที่เกินจากการฝากแบบไร้ความเสี่ยง", { exact: false }).first(),
    ).toBeVisible()
  })

  test("AC-SUM-05 พอร์ตที่ไม่มีเดือนขาดทุน Sortino แสดงเป็นขีดพร้อมเหตุผล", async ({ page }) => {
    await page.goto("/backtest?assets=UPONLY:100&start=2012&end=2026&amount=10000&benchmark=SPY")

    await expect(page.getByTestId("portfolio-sortino")).toHaveText("—", { timeout: 15_000 })
    await expect(page.getByText("คำนวณไม่ได้เพราะไม่มีเดือนที่ขาดทุน")).toBeVisible()
    // ค่าที่คำนวณได้ยังแสดงตามปกติ
    await expect(page.getByTestId("portfolio-sharpe")).not.toHaveText("—")
  })

  test("AC-SUM-09 คำเตือนการลงทุนอยู่คู่กับผลลัพธ์", async ({ page }) => {
    await page.goto(REFERENCE_LINK)
    await expect(page.getByRole("heading", { name: "สรุปผลการทดสอบ" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByText(
        "ผลตอบแทนในอดีตไม่ได้รับประกันผลตอบแทนในอนาคต ข้อมูลในเว็บนี้ไม่ใช่คำแนะนำการลงทุน",
      ),
    ).toBeVisible()
  })

  test("AC-SUM-08 แก้พอร์ตแล้วรันใหม่ ผลเก่าไม่ค้าง", async ({ page }) => {
    await page.goto(REFERENCE_LINK)
    await expect(page.getByTestId("portfolio-endBalance")).toHaveText("$41,495", {
      timeout: 15_000,
    })

    await page.locator("#symbol-0").fill("SPY")
    await page.keyboard.press("Escape") // ปิดรายการแนะนำก่อนไปกดตัวควบคุมอื่น
    await page.locator("#weight-0").fill("100")
    for (const index of [3, 2, 1]) {
      await page.getByRole("button", { name: "ลบสินทรัพย์แถวนี้" }).nth(index).click()
    }
    await page.getByRole("button", { name: "เริ่มทดสอบ", exact: true }).click()

    await expect(page.getByTestId("portfolio-endBalance")).toHaveText("$76,589", {
      timeout: 15_000,
    })
  })

  test("N-001 ช่วงถูกย่อ ตารางยังแสดงพร้อมข้อความแจ้ง", async ({ page }) => {
    await page.goto("/backtest?assets=NEWFUND:50,VTI:50&start=2012&end=2026&benchmark=SPY")

    await expect(page.getByRole("heading", { name: "สรุปผลการทดสอบ" })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText("ช่วงเวลาถูกปรับเป็น", { exact: false })).toBeVisible()
  })

  test("จอแคบและโหมดมืด", async ({ browser }) => {
    const dark = await browser.newContext({ colorScheme: "dark" })
    const darkPage = await dark.newPage()
    await darkPage.goto(REFERENCE_LINK)
    await expect(darkPage.getByTestId("portfolio-cagr")).toHaveText("10.31%", { timeout: 15_000 })
    await darkPage.screenshot({ path: `${EVIDENCE}/summary-dark.png`, fullPage: true })
    await dark.close()

    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto(REFERENCE_LINK)
    await expect(mobilePage.getByTestId("portfolio-cagr")).toHaveText("10.31%", { timeout: 15_000 })

    const overflow = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, "หน้าเว็บต้องไม่เลื่อนแนวนอน ตารางเลื่อนในกรอบตัวเอง").toBeLessThanOrEqual(0)

    await mobilePage.screenshot({ path: `${EVIDENCE}/summary-mobile.png`, fullPage: true })
    await mobile.close()
  })
})
