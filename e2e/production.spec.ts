import { expect, test, type Page } from "@playwright/test"

/**
 * เดินทุกส่วนหลักของ US-05 ถึง US-11 บนเครื่องให้บริการจริงด้วยข้อมูลจริง (R17 ของ S8)
 *
 * ต่างจากชุดทดสอบอื่นตรงที่ **ไม่ผูกกับค่าตายตัว** เพราะข้อมูลจริงขยับได้เมื่อมีปันผลรอบใหม่
 * สิ่งที่ตรวจคือโครงสร้าง ความสอดคล้องระหว่างส่วน และค่าที่อยู่ในช่วงที่สมเหตุสมผล
 * รันด้วย: PROD_URL=https://… npx playwright test e2e/production.spec.ts
 */
const PROD_URL = process.env.PROD_URL
const EVIDENCE = "artifacts/evidence/S8"
const REFERENCE =
  "/backtest?assets=VTI:48,VNQ:8,VXUS:24,BND:20&start=2012&end=2026&amount=10000&benchmark=SPY"

test.skip(!PROD_URL, "ตั้ง PROD_URL ก่อนจึงจะเดินบนเครื่องให้บริการจริง")

const url = (path: string) => `${PROD_URL}${path}`

async function openReference(page: Page) {
  await page.goto(url(REFERENCE))
  await expect(page.getByTestId("drawdown-table")).toBeVisible({ timeout: 60_000 })
}

/** อ่านตัวเลขจากข้อความบนจอ เช่น "10.31%" → 10.31 */
function toNumber(text: string | null): number {
  return Number((text ?? "").replace(/[^0-9.-]/g, ""))
}

test.describe("US-11 หน้าแรกและพอร์ตตัวอย่าง", () => {
  test("พอร์ตตัวอย่างสามชุดกดแล้วได้ผลจริงครบ", async ({ page }) => {
    await page.goto(url("/"))
    await expect(page.getByTestId("demo-balanced")).toBeVisible()
    await expect(page.getByTestId("demo-allUsStocks")).toBeVisible()
    await expect(page.getByTestId("demo-global")).toBeVisible()
    await page.screenshot({ path: `${EVIDENCE}/prod-home.png`, fullPage: true })

    for (const key of ["balanced", "allUsStocks", "global"]) {
      await page.goto(url("/"))
      await page.getByTestId(`demo-${key}`).click()
      await page.waitForURL(/\/backtest\?/)
      await expect(page.getByTestId("portfolio-cagr")).toBeVisible({ timeout: 60_000 })
      await expect(
        page.getByText("ช่วงเวลาถูกปรับเป็น"),
        `ชุด ${key} ต้องไม่เจอข้อความช่วงถูกย่อ`,
      ).toHaveCount(0)
    }
  })
})

test.describe("US-05/US-06 ฟอร์มและลิงก์", () => {
  test("กรอกเองแล้วรันได้ ลิงก์เปลี่ยนตาม และเปิดซ้ำได้ผลเดิม", async ({ page }) => {
    await page.goto(url("/backtest"))
    await page.locator("#p0-symbol-0").fill("AAPL")
    await page.locator("#p0-weight-0").fill("70")
    await page.locator("#p0-symbol-1").fill("MSFT")
    await page.locator("#p0-weight-1").fill("30")
    await page.getByRole("button", { name: "เริ่มทดสอบ", exact: true }).click()

    await expect(page.getByTestId("portfolio-cagr")).toBeVisible({ timeout: 60_000 })
    await expect(page).toHaveURL(/assets=AAPL:70,MSFT:30/)
    const first = await page.getByTestId("portfolio-cagr").textContent()

    await page.reload()
    await expect(page.getByTestId("portfolio-cagr")).toHaveText(first!, { timeout: 60_000 })
  })

  test("สัญลักษณ์ที่ไม่มีจริง แจ้งให้แก้ได้", async ({ page }) => {
    await page.goto(url("/backtest"))
    await page.locator("#p0-symbol-0").fill("ZQXWV")
    await page.locator("#p0-symbol-0").blur()
    await expect(page.getByText(/ไม่พบข้อมูลของ ZQXWV/)).toBeVisible({ timeout: 60_000 })
  })
})

test.describe("US-07 ถึง US-10 ผลลัพธ์ครบทุกส่วนด้วยข้อมูลจริง", () => {
  test("ตารางสรุป กราฟสองตัว และช่วงขาดทุน สอดคล้องกัน", async ({ page }) => {
    const started = Date.now()
    await openReference(page)
    const elapsed = (Date.now() - started) / 1000

    // ตัววัดของ epic §3: ผลครบภายใน 5 วินาทีบนเครื่องที่ให้บริการจริง
    expect(elapsed, `ผลครบใน ${elapsed.toFixed(1)} วินาที`).toBeLessThan(5)

    await expect(page.getByTestId("summary-rows").locator("tr")).toHaveCount(9)
    await expect(page.getByTestId("growth-chart").locator(".recharts-line")).toHaveCount(2)
    await expect(page.getByTestId("annual-chart").locator(".recharts-bar-rectangle")).toHaveCount(30)
    await expect(page.getByTestId("drawdown-table").locator("tr")).toHaveCount(5)

    // ค่าจากข้อมูลจริงต้องอยู่ในช่วงที่สมเหตุสมผลของพอร์ตนี้
    const cagr = toNumber(await page.getByTestId("portfolio-cagr").textContent())
    expect(cagr, "ผลตอบแทนต่อปีของพอร์ตอ้างอิง").toBeGreaterThan(8)
    expect(cagr).toBeLessThan(13)

    // ความลึกอันดับหนึ่งต้องตรงกับตารางสรุปเสมอ ไม่ว่าข้อมูลจะขยับแค่ไหน (BR-DDW-04)
    const summaryDepth = (await page.getByTestId("portfolio-maxDrawdown").textContent())!.trim()
    await expect(page.getByTestId("drawdown-depth-1")).toHaveText(summaryDepth.split("\n")[0])

    // ปีที่ดีที่สุดในตารางสรุปต้องตรงกับตารางรายปี (BR-ANN-05)
    const bestYear = toNumber(await page.getByTestId("portfolio-bestYear").textContent())
    const annual2019 = toNumber(await page.getByTestId("annual-2019").textContent())
    expect(bestYear).toBeCloseTo(annual2019, 1)

    await page.screenshot({ path: `${EVIDENCE}/prod-results.png`, fullPage: true })
  })

  test("คำอธิบายศัพท์ ภาษา ธีม และคำเตือน ใช้ได้จริง", async ({ page }) => {
    await openReference(page)
    await expect(
      page.getByText("ผลตอบแทนในอดีตไม่ได้รับประกันผลตอบแทนในอนาคต"),
    ).toBeVisible()

    await page.getByRole("button", { name: /ดูคำอธิบายของ Sharpe/ }).focus()
    await expect(page.getByText(/ผลตอบแทนส่วนที่เกินจากการฝากแบบไร้ความเสี่ยง/)).toBeVisible()

    await page.getByRole("button", { name: "สลับโหมดสว่างและมืด" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.screenshot({ path: `${EVIDENCE}/prod-results-dark.png`, fullPage: true })

    await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()
    await expect(page.getByText("Past performance does not guarantee")).toBeVisible()
  })

  test("ใช้งานบนจอแคบได้", async ({ browser }) => {
    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const page = await mobile.newPage()
    await page.goto(url(REFERENCE))
    await expect(page.getByTestId("drawdown-table")).toBeVisible({ timeout: 60_000 })

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, "หน้าเว็บต้องไม่เลื่อนแนวนอน").toBeLessThanOrEqual(0)
    await page.screenshot({ path: `${EVIDENCE}/prod-mobile.png`, fullPage: true })
    await mobile.close()
  })
})

/**
 * S17b — ข้อนี้อยู่ในชุดของเครื่องให้บริการจริงโดยเจตนา
 *
 * ปุ่มคืนค่าเริ่มต้นเคย **ไม่ทำงานเฉพาะบนรุ่นที่ build แล้ว**: หน้านี้ถูกสร้างเป็นหน้านิ่ง
 * ไว้ล่วงหน้า การสั่งเปลี่ยนเส้นทางฝั่งผู้ใช้ไปที่ `/backtest` ตอนที่อยู่ที่ `/backtest` อยู่แล้ว
 * จึงถูกมองว่าไปที่เดิมแล้วเงียบไป · บน `next dev` ทำงานปกติ **ชุดทดสอบปกติจึงจับไม่ได้เลย**
 * — ต้องเดินบนรุ่นจริงเท่านั้น
 */
test.describe("US-35 ปุ่มคืนค่าเริ่มต้นบนรุ่นจริง", () => {
  test("กดแล้วล้างจริง และย้อนกลับได้ผลเดิมคืนมา", async ({ page }) => {
    await openReference(page)
    const before = await page.getByTestId("portfolio-endBalance").textContent()

    await page.getByRole("button", { name: "คืนค่าเริ่มต้น", exact: true }).click()

    await expect(page).toHaveURL(url("/backtest"))
    await expect(page.getByTestId("growth-chart")).toHaveCount(0)
    await expect(page.locator("#p0-symbol-0")).toHaveValue("")

    await page.goBack()
    await expect(page.getByTestId("portfolio-endBalance")).toHaveText(before!, { timeout: 60_000 })
  })
})
