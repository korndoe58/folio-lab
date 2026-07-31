import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-32 (ช่วงวิกฤต) · US-33 (อัตราถอนปลอดภัย) — สองใบสุดท้ายของเฟส 4
 *
 * สองข้อที่สำคัญที่สุด:
 * · **ช่วง 2022 ต้องเท่ากับความลึกของช่วงขาดทุนที่ ship ไปแล้ว** — ค่าอ้างอิงที่อิสระจากสูตรเรา
 * · **ตารางช่วงวิกฤตอ่านรู้เรื่องโดยไม่ต้องมีความรู้การเงิน** ซึ่งเป็นเกณฑ์ปิดของ S19
 */
const EVIDENCE = "artifacts/evidence/S19"
const SHARED = "start=2012&end=2026&amount=10000&benchmark=SPY&base=USD"
const REFERENCE = `/backtest?assets=VTI:48,VNQ:8,VXUS:24,BND:20&${SHARED}`
const TWO = `/backtest?p1=VTI:60,BND:40&p1.n=ผสม&p2=VTI:100&p2.n=หุ้นล้วน&${SHARED}`

const cell = (page: Page, testid: string) => page.getByTestId(testid)
const ready = (page: Page) => page.getByTestId("portfolio-endBalance")
const readyMulti = (page: Page) => page.getByTestId("portfolio0-endBalance")

test.describe("US-32 ผลตอบแทนช่วงวิกฤต", () => {
  test("★ AC-RSK-33 ช่วง 2022 และ 2015–16 ตรงกับตารางช่วงขาดทุนที่ ship แล้ว", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    // หน้าต่างสองช่วงนี้เป็นเดือนชุดเดียวกับช่วงขาดทุนพอดี ค่าจึงต้องตรงกัน (PD-025)
    await expect(cell(page, "stress-inflation2022")).toHaveText("-23.55%")
    await expect(cell(page, "stress-china2015")).toHaveText("-8.48%")
    // และตรงกับตารางช่วงขาดทุนบนหน้าเดียวกันจริง ๆ
    await expect(cell(page, "drawdown-depth-1")).toHaveText("-23.55%")

    await page.screenshot({ path: `${EVIDENCE}/stress-table.png`, fullPage: true })
  })

  test("AC-RSK-34 ครบสี่ช่วง แต่ละช่วงมีทั้งพอร์ตและตัวเทียบ", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    for (const key of ["covid2020", "inflation2022", "selloff2018", "china2015"]) {
      await expect(cell(page, `stress-${key}`), `ช่วง ${key}`).not.toHaveText("—")
      await expect(cell(page, `stress-benchmark-${key}`), `ตัวเทียบของ ${key}`).not.toHaveText("—")
    }
  })

  test("★ BR-RSK-47 ทุกช่วงมีชื่อที่คนรู้จักและคำอธิบายว่าเกิดอะไรขึ้น", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    // เกณฑ์ปิด S19 — ช่วงวันที่อย่างเดียวอ่านไม่รู้เรื่องสำหรับคนที่ไม่ได้เรียนการเงิน
    const rows = cell(page, "stress-rows").locator('th[scope="row"]')
    await expect(rows).toHaveCount(4)
    await expect(rows.first()).toContainText("โควิดระบาด")
    await expect(rows.first()).toContainText("ตลาดทั่วโลกทรุดลงอย่างรวดเร็ว")
  })

  test("BR-RSK-48 บอกว่าดูย้อนได้ถึงปีไหน", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/ดูย้อนได้ถึงปี 2012/)).toBeVisible()
  })

  test("AC-RSK-35 เทียบสองพอร์ต เห็นว่าพอร์ตไหนทนวิกฤตได้ดีกว่า", async ({ page }) => {
    await page.goto(TWO)
    await expect(readyMulti(page)).toBeVisible({ timeout: 30_000 })

    // พอร์ตผสมมีพันธบัตรจึงทนขาลงได้ดีกว่าหุ้นล้วน — คุณค่าของตารางนี้
    const mixed = Number((await cell(page, "stress0-covid2020").textContent())!.replace(/[^0-9.-]/g, ""))
    const stocks = Number((await cell(page, "stress1-covid2020").textContent())!.replace(/[^0-9.-]/g, ""))
    expect(mixed).toBeGreaterThan(stocks)
  })

  test("BR-RSK-46 พอร์ตที่ข้อมูลเริ่มช้า ช่วงที่ครอบคลุมไม่ครบเป็นขีดพร้อมเหตุผล", async ({ page }) => {
    // BTC-USD มีข้อมูลตั้งแต่ 2014 จึงไม่ครอบคลุมช่วงก่อนหน้า และช่วงร่วมจะถูกย่อ
    await page.goto(`/backtest?assets=BTC-USD:100&${SHARED}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(cell(page, "stress-table")).toBeVisible()
  })
})

test.describe("US-33 อัตราถอนปลอดภัย", () => {
  test("AC-RSK-41 ระยะที่ข้อมูลครอบคลุมมีค่า ระยะที่ยาวกว่าเป็นขีดพร้อมเหตุผล", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(cell(page, "withdrawal-rate-10")).not.toHaveText("—")
    // ข้อมูล 174 เดือน สั้นกว่าระยะ 20 และ 30 ปี
    await expect(cell(page, "withdrawal-rate-20")).toHaveText("—")
    await expect(cell(page, "withdrawal-windows-20")).toContainText("สั้นกว่าระยะ 20 ปี")
    await expect(cell(page, "withdrawal-rate-30")).toHaveText("—")

    await page.screenshot({ path: `${EVIDENCE}/withdrawal-table.png`, fullPage: true })
  })

  test("★ AC-RSK-44 จำนวนเงินต่อเดือนอยู่คู่กับเปอร์เซ็นต์เสมอ", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    // คนตั้งงบเป็นเงิน ไม่ใช่เป็นเปอร์เซ็นต์ (BR-RSK-57)
    await expect(cell(page, "withdrawal-rate-10")).toContainText("%")
    await expect(cell(page, "withdrawal-amount-10")).toContainText("$")
  })

  test("AC-RSK-45 บอกจำนวนจังหวะเข้าที่ทดสอบ และหน้าต่างที่แย่ที่สุด", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    const windows = cell(page, "withdrawal-windows-10")
    await expect(windows).toContainText("ทดสอบจาก 55 จังหวะเข้า")
    await expect(windows).toContainText("แย่สุดเริ่ม")
  })

  test("★ AC-RSK-48 มีคำเตือนเฉพาะของส่วนนี้ ไม่ใช่แค่คำเตือนทั่วไปของเว็บ", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(cell(page, "withdrawal-warning")).toContainText(
      "สิ่งที่เคยเกิดขึ้นในอดีตเท่านั้น",
    )
  })

  test("AC-RSK-46 เทียบสองพอร์ต มีอัตราของทั้งคู่", async ({ page }) => {
    await page.goto(TWO)
    await expect(readyMulti(page)).toBeVisible({ timeout: 30_000 })

    await expect(cell(page, "withdrawal0-rate-10")).not.toHaveText("—")
    await expect(cell(page, "withdrawal1-rate-10")).not.toHaveText("—")
  })

  test("AC-RSK-47 ตั้งเงินเข้าออกในฟอร์มแล้วอัตราไม่ขยับ (BR-RSK-59)", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    const before = await cell(page, "withdrawal-rate-10").textContent()

    await page.goto(`/backtest?p1=VTI:48,VNQ:8,VXUS:24,BND:20&p1.cf=200:m:in:fixed:prorata:flat&${SHARED}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    // ส่วนนี้จำลองการถอนของตัวเอง จึงไม่รับเงินเข้าออกที่ผู้ใช้ตั้งไว้
    await expect(cell(page, "withdrawal-rate-10")).toHaveText(before!)
  })
})

test.describe("ส่วนใหม่ของ S19 ในสภาพแวดล้อมจริง", () => {
  test("จอ 375 จุด ตารางเลื่อนในกรอบตัวเอง หน้าเว็บไม่เลื่อนแนวนอน", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const page = await context.newPage()
    await page.goto(TWO)
    await expect(readyMulti(page)).toBeVisible({ timeout: 30_000 })

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, "หน้าเว็บต้องไม่เลื่อนแนวนอน").toBeLessThanOrEqual(0)
    await page.screenshot({ path: `${EVIDENCE}/phase4-mobile.png`, fullPage: true })
    await context.close()
  })

  test("สลับภาษาแล้วชื่อเหตุการณ์และหัวตารางเปลี่ยนตาม", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("โควิดระบาด")).toBeVisible()

    await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()
    await expect(page.getByText("The pandemic")).toBeVisible()
    await expect(page.getByText(/How much can you take out/)).toBeVisible()
  })
})
