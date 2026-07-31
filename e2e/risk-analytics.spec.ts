import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-28 (ความสัมพันธ์) · US-29 (แยกส่วน) · US-30 (เทียบตลาด) · US-31 (ความเสี่ยงหาง)
 *
 * เทสต์ที่สำคัญที่สุดของไฟล์นี้คือ **น้ำหนักที่ใส่ไม่เท่ากับความเสี่ยงที่รับ** — เป็นคุณค่า
 * ทั้งหมดของ US-29 และเป็นข้อที่ตัวเลขต้องพูดเอง ไม่ใช่แค่มีตารางโผล่มา
 */
const EVIDENCE = "artifacts/evidence/S18"
const SHARED = "start=2015&end=2025&amount=10000&benchmark=SPY&base=USD"
/** พอร์ตอ้างอิงของ golden fixture — ค่าที่เทียบกับต้นแบบได้อยู่ที่ชุดนี้ */
const REFERENCE =
  "/backtest?assets=VTI:48,VNQ:8,VXUS:24,BND:20&start=2012&end=2026&amount=10000&benchmark=SPY&base=USD"
const THREE = `p1=VTI:60,BND:40&p1.n=ผสม&p2=VTI:100&p2.n=หุ้นล้วน&p3=VNQ:50,BND:50&${SHARED}`

const cell = (page: Page, testid: string) => page.getByTestId(testid)
const ready = (page: Page) => page.getByTestId("portfolio-endBalance")
const readyMulti = (page: Page) => page.getByTestId("portfolio0-endBalance")

test.describe("US-30 + US-31 แถวเมทริกเชิงลึกในตารางสรุป", () => {
  test("AC-RSK-01..16 ค่าบนจอตรงกับชุดอ้างอิงของต้นแบบ", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(cell(page, "portfolio-beta")).toHaveText("0.79")
    await expect(cell(page, "portfolio-alpha")).toHaveText("-1.36%")
    await expect(cell(page, "portfolio-rSquared")).toHaveText("93.14%")
    await expect(cell(page, "portfolio-upsideCapture")).toHaveText("72.18%")
    await expect(cell(page, "portfolio-downsideCapture")).toHaveText("85.25%")
    await expect(cell(page, "portfolio-varHistorical")).toHaveText("5.24%")
    await expect(cell(page, "portfolio-varAnalytical")).toHaveText("4.55%")
    await expect(cell(page, "portfolio-cvar")).toHaveText("7.04%")

    await page.screenshot({ path: `${EVIDENCE}/summary-phase4.png`, fullPage: true })
  })

  test("★ เก้าแถวเดิมไม่ขยับสักหลักหลังเพิ่มสิบสามแถว", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(cell(page, "portfolio-endBalance")).toHaveText("$41,495")
    await expect(cell(page, "portfolio-cagr")).toHaveText("10.31%")
    await expect(cell(page, "portfolio-stdev")).toHaveText("11.42%")
    await expect(cell(page, "portfolio-maxDrawdown")).toHaveText("-23.55%")
    await expect(cell(page, "portfolio-sharpe")).toHaveText("0.78")
    await expect(cell(page, "portfolio-sortino")).toHaveText("1.19")
  })

  test("แถวใหม่แบ่งสองกลุ่มพร้อมหัวกลุ่มคั่น", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(cell(page, "summary-group-benchmarkRelative")).toHaveText("เทียบกับตลาด")
    await expect(cell(page, "summary-group-tailRisk")).toHaveText(
      "เดือนที่แย่ที่สุดและรูปร่างการกระจาย",
    )
  })

  test("BR-RSK-24 VaR และ CVaR แสดงเป็นขนาดของการขาดทุน คือค่าบวก", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    for (const metric of ["varHistorical", "varAnalytical", "cvar"]) {
      await expect(cell(page, `portfolio-${metric}`)).not.toContainText("-")
    }
  })
})

test.describe("US-28 ตารางความสัมพันธ์", () => {
  test("AC-RSK-17..19 ค่าตรงต้นแบบ และครอบคลุมทุกสินทรัพย์บวกตัวเทียบ", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    const headers = await cell(page, "correlation-table").locator("thead th").allInnerTexts()
    // ทุกสินทรัพย์ในพอร์ต **บวกตัวเทียบ** (BR-RSK-28)
    expect(headers.filter(Boolean)).toEqual(["VTI", "VNQ", "VXUS", "BND", "SPY"])

    await expect(cell(page, "correlation-VXUS-VTI")).toHaveText("0.83")
    await expect(cell(page, "correlation-BND-VTI")).toHaveText("0.36")
  })

  test("AC-RSK-23 ตารางสามเหลี่ยม เส้นทแยงมุมเป็นหนึ่ง ครึ่งบนเว้นว่าง", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(cell(page, "correlation-VTI-VTI")).toHaveText("1.00")
    await expect(cell(page, "correlation-SPY-SPY")).toHaveText("1.00")
    // ครึ่งบนไม่ถูกวาด — ช่อง VTI–SPY มีเฉพาะทางเดียว
    await expect(cell(page, "correlation-VTI-SPY")).toHaveCount(0)
  })

  test("BR-RSK-33 มีคำอธิบายว่าเลขสูงแปลว่าอะไร", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/เลขใกล้ 1 แปลว่า/)).toBeVisible()
  })
})

test.describe("US-29 แยกส่วนผลตอบแทนและความเสี่ยง", () => {
  test("★ AC-RSK-25..32 น้ำหนักที่ใส่ไม่เท่ากับความเสี่ยงที่รับ", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    // BND ใส่เงินไป 20% แต่แทบไม่ได้เพิ่มความเหวี่ยงให้พอร์ตเลย — คุณค่าทั้งหมดของส่วนนี้
    await expect(cell(page, "decomposition-BND-weight")).toHaveText("20.00%")
    const risk = await cell(page, "decomposition-BND-risk").textContent()
    expect(Number(risk!.replace("%", ""))).toBeLessThan(10)

    // ส่วนแบ่งกำไรมีทั้งเปอร์เซ็นต์และจำนวนเงิน (BR-RSK-36)
    await expect(cell(page, "decomposition-VTI-return")).toContainText("%")
    await expect(cell(page, "decomposition-VTI-amount")).toContainText("$")

    await page.screenshot({ path: `${EVIDENCE}/decomposition.png`, fullPage: true })
  })

  test("BR-RSK-40 น้ำหนักอยู่ติดกับส่วนแบ่งความเสี่ยงในตารางเดียวกัน", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    const headers = await cell(page, "decomposition-table").locator("thead th").allInnerTexts()
    expect(headers).toEqual([
      "สินทรัพย์",
      "น้ำหนัก",
      "ส่วนแบ่งความเสี่ยง",
      "ส่วนแบ่งกำไร",
      "กำไรเป็นเงิน",
    ])
  })

  test("ส่วนแบ่งความเสี่ยงรวมกันได้ 100%", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    const shares = await Promise.all(
      ["VTI", "VNQ", "VXUS", "BND"].map(async (symbol) =>
        Number((await cell(page, `decomposition-${symbol}-risk`).textContent())!.replace("%", "")),
      ),
    )
    expect(shares.reduce((sum, v) => sum + v, 0)).toBeCloseTo(100, 0)
  })
})

test.describe("BR-RSK-06 ตัวเลือกพอร์ตของตารางใหญ่", () => {
  test("พอร์ตเดียวไม่มีตัวเลือก · หลายพอร์ตมีและสลับได้จริง", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(page.locator("#correlation-portfolio")).toHaveCount(0)
    await expect(page.locator("#decomposition-portfolio")).toHaveCount(0)

    await page.goto(`/backtest?${THREE}`)
    await expect(readyMulti(page)).toBeVisible({ timeout: 30_000 })
    await expect(page.locator("#decomposition-portfolio")).toBeVisible()

    // พอร์ตแรกคือ VTI/BND · พอร์ตที่สามคือ VNQ/BND
    await expect(cell(page, "decomposition-VTI-weight")).toBeVisible()
    await page.locator("#decomposition-portfolio").selectOption("2")
    await expect(cell(page, "decomposition-VNQ-weight")).toBeVisible()
    await expect(cell(page, "decomposition-VTI-weight")).toHaveCount(0)
  })
})

test.describe("ส่วนใหม่ในสภาพแวดล้อมจริง", () => {
  test("จอ 375 จุด ตารางเลื่อนในกรอบตัวเอง หน้าเว็บไม่เลื่อนแนวนอน", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const page = await context.newPage()
    await page.goto(`/backtest?${THREE}`)
    await expect(readyMulti(page)).toBeVisible({ timeout: 30_000 })

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, "หน้าเว็บต้องไม่เลื่อนแนวนอน").toBeLessThanOrEqual(0)
    await page.screenshot({ path: `${EVIDENCE}/risk-mobile.png`, fullPage: true })
    await context.close()
  })

  test("สลับภาษาแล้วป้ายของแถวใหม่เปลี่ยนตาม", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole("rowheader", { name: "ความเบ้" })).toBeVisible()

    await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()
    await expect(page.getByRole("rowheader", { name: "Skew" })).toBeVisible()
  })
})
