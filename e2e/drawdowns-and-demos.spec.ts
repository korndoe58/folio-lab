import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-10 + US-11 — เดิน route จริงทั้งหน้าแรกและหน้าทดสอบ
 * และพิสูจน์ว่าความลึกอันดับหนึ่งตรงกับตารางสรุป (BR-DDW-04)
 */
const EVIDENCE = "artifacts/evidence/S7"
const REFERENCE_LINK =
  "/backtest?assets=VTI:48,VNQ:8,VXUS:24,BND:20&start=2012&end=2026&amount=10000&benchmark=SPY"

const drawdownTable = (page: Page) => page.getByTestId("drawdown-table")

async function openReference(page: Page) {
  await page.goto(REFERENCE_LINK)
  await expect(drawdownTable(page)).toBeVisible({ timeout: 15_000 })
}

test.describe("US-10 ช่วงขาดทุนและเวลาฟื้น", () => {
  test("AC-DDW-01/03 ตาราง 5 อันดับตรงกับชุดอ้างอิงทุกคอลัมน์", async ({ page }) => {
    await openReference(page)
    await expect(page.getByRole("heading", { name: "ช่วงขาดทุนและเวลาฟื้น" })).toBeVisible()
    await expect(drawdownTable(page).locator("tr")).toHaveCount(5)

    // แถวที่ 2 ใช้ค่าที่ข้อมูลของเราให้ ตาม PD-007
    const expected = [
      { depth: "-23.55%", recovered: "มีนาคม 2024", duration: "1 ปี 6 เดือน" },
      { depth: "-17.35%", recovered: "กรกฎาคม 2020", duration: "4 เดือน" },
      { depth: "-10.18%", recovered: "เมษายน 2019", duration: "4 เดือน" },
      { depth: "-8.48%", recovered: "กรกฎาคม 2016", duration: "5 เดือน" },
      { depth: "-6.23%", recovered: "สิงหาคม 2012", duration: "3 เดือน" },
    ]
    for (const [i, row] of expected.entries()) {
      const rank = i + 1
      await expect(page.getByTestId(`drawdown-depth-${rank}`)).toHaveText(row.depth)
      await expect(page.getByTestId(`drawdown-recovered-${rank}`)).toHaveText(row.recovered)
      await expect(page.getByTestId(`drawdown-duration-${rank}`)).toHaveText(row.duration)
    }
  })

  test("AC-DDW-02 ความลึกอันดับหนึ่งตรงกับตารางสรุป", async ({ page }) => {
    await openReference(page)
    const summaryDepth = await page.getByTestId("portfolio-maxDrawdown").textContent()
    await expect(page.getByTestId("drawdown-depth-1")).toHaveText(summaryDepth!.trim().split("\n")[0])
  })

  test("BR-DDW-06 บอกจำนวนช่วงทั้งหมดที่พบ", async ({ page }) => {
    await openReference(page)
    await expect(page.getByTestId("drawdown-count")).toContainText("27")
  })

  test("AC-DDW-04 ช่วงที่ยังไม่ฟื้น แสดงข้อความแทนตัวเลข", async ({ page }) => {
    await page.goto("/backtest?assets=DOWNONLY:100&start=2012&end=2026&amount=10000&benchmark=SPY")
    await expect(drawdownTable(page)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("drawdown-recovered-1")).toHaveText("ยังไม่ฟื้น")
    await expect(page.getByTestId("drawdown-duration-1")).toHaveText("ยังไม่ฟื้น")
  })

  test("AC-DDW-09 ไม่พบช่วงขาดทุน แสดงข้อความ ไม่ใช่ตารางเปล่า", async ({ page }) => {
    await page.goto("/backtest?assets=UPONLY:100&start=2012&end=2026&amount=10000&benchmark=SPY")
    await expect(page.getByTestId("drawdown-none")).toBeVisible({ timeout: 15_000 })
    await expect(drawdownTable(page)).toHaveCount(0)
  })
})

test.describe("US-11 พอร์ตตัวอย่างบนหน้าแรก", () => {
  test("AC-DMO-01 หน้าแรกมีพอร์ตตัวอย่างสามชุดพร้อมส่วนผสม", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByTestId("demo-balanced")).toBeVisible()
    await expect(page.getByTestId("demo-allUsStocks")).toBeVisible()
    await expect(page.getByTestId("demo-global")).toBeVisible()

    await expect(page.getByTestId("demo-balanced")).toContainText("หุ้นและพันธบัตร 60 ต่อ 40")
    await expect(page.getByTestId("demo-balanced")).toContainText("VTI 60% · BND 40%")
    // ข้อความว่ากำลังพัฒนาต้องไม่มีแล้ว (BR-DMO-06)
    await expect(page.getByText("กำลังพัฒนา")).toHaveCount(0)
  })

  test("AC-DMO-02/05 ทั้งสามชุดกดแล้วได้ผลทันที โดยไม่มีข้อความช่วงถูกย่อ", async ({ page }) => {
    for (const key of ["balanced", "allUsStocks", "global"]) {
      await page.goto("/")
      await page.getByTestId(`demo-${key}`).click()
      await page.waitForURL(/\/backtest\?/)
      await expect(page.getByTestId("portfolio-cagr")).toBeVisible({ timeout: 15_000 })
      await expect(
        page.getByText("ช่วงเวลาถูกปรับเป็น"),
        `ชุด ${key} ต้องไม่ทำให้ผู้ใช้เจอข้อความช่วงถูกย่อ`,
      ).toHaveCount(0)
      await expect(page).toHaveURL(/start=2015&end=2025/)
    }
  })

  test("AC-DMO-03 แก้ค่าต่อจากพอร์ตตัวอย่างได้", async ({ page }) => {
    await page.goto("/")
    await page.getByTestId("demo-balanced").click()
    await page.waitForURL(/\/backtest\?/)
    await expect(page.getByTestId("portfolio-cagr")).toBeVisible({ timeout: 15_000 })
    const before = await page.getByTestId("portfolio-cagr").textContent()

    await page.locator("#p0-weight-0").fill("80")
    await page.locator("#p0-weight-1").fill("20")
    await page.getByRole("button", { name: "เริ่มทดสอบ", exact: true }).click()

    await expect(page).toHaveURL(/assets=VTI:80,BND:20/)
    await expect(page.getByTestId("portfolio-cagr")).not.toHaveText(before!)
  })

  test("AC-DMO-04 ปุ่มเริ่มทดสอบพาไปฟอร์มเปล่าโดยไม่มีข้อผิดพลาด", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: "เริ่มทดสอบพอร์ต" }).click()
    await page.waitForURL(/\/backtest/)
    await expect(page.getByRole("heading", { name: "ตั้งค่าพอร์ตที่จะทดสอบ" })).toBeVisible()
    // เจาะจงแถบข้อความของเราเอง ไม่ใช่ตัวประกาศเส้นทางของเฟรมเวิร์กที่ก็มี role เดียวกัน
    await expect(page.locator('[data-slot="alert"]')).toHaveCount(0)
  })

  test("AC-DMO-07 สลับภาษาแล้วชื่อพอร์ตตัวอย่างเปลี่ยน แต่สัญลักษณ์คงเดิม", async ({ page }) => {
    await page.goto("/")
    await expect(async () => {
      await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()
      await expect(page.getByTestId("demo-balanced")).toContainText("60/40 stocks and bonds", {
        timeout: 1_000,
      })
    }).toPass({ timeout: 15_000 })
    await expect(page.getByTestId("demo-balanced")).toContainText("VTI 60% · BND 40%")
  })

  test("AC-DMO-06 หน้าแรกบนจอแคบ และภาพหลักฐาน", async ({ page, browser }) => {
    await page.goto("/")
    await page.screenshot({ path: `${EVIDENCE}/home-light.png`, fullPage: true })
    await page.getByRole("button", { name: "สลับโหมดสว่างและมืด" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.screenshot({ path: `${EVIDENCE}/home-dark.png`, fullPage: true })

    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto("/")
    await expect(mobilePage.getByTestId("demo-global")).toBeVisible()
    const overflow = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, "หน้าแรกต้องไม่เลื่อนแนวนอนบนจอแคบ").toBeLessThanOrEqual(0)
    await mobilePage.screenshot({ path: `${EVIDENCE}/home-mobile.png`, fullPage: true })

    await mobilePage.goto(REFERENCE_LINK)
    await expect(drawdownTable(mobilePage)).toBeVisible({ timeout: 15_000 })
    await mobilePage.screenshot({ path: `${EVIDENCE}/drawdown-mobile.png`, fullPage: true })
    await mobile.close()
  })
})
