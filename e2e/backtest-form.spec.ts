import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-05 + US-06 ในรูปสคริปต์ — เดิน route จริงและกดทุกตัวควบคุมที่การ์ดพูดถึง
 */
const EVIDENCE = "artifacts/evidence/S4"
const FULL_LINK =
  "/backtest?assets=VTI:60,BND:40&start=2015&end=2025&amount=10000&benchmark=SPY"

const symbol = (page: Page, index: number) => page.locator(`#symbol-${index}`)
const weight = (page: Page, index: number) => page.locator(`#weight-${index}`)
const submit = (page: Page) => page.getByRole("button", { name: "เริ่มทดสอบ", exact: true })
/** ผลลัพธ์พร้อมแล้ว — ตั้งแต่ US-07 เป็นต้นไปคือตารางสรุป (เดิมเป็นแถบช่วงเวลาขั้นต่ำ) */
const resultsReady = (page: Page) => page.getByRole("heading", { name: "สรุปผลการทดสอบ" })

/**
 * กรอกช่องที่มีรายการแนะนำ แล้วปิดรายการเหมือนที่ผู้ใช้ทำก่อนไปทำอย่างอื่นต่อ —
 * ขณะรายการเปิดอยู่ ส่วนที่เหลือของฟอร์มถูกกันไว้จากโปรแกรมอ่านหน้าจอ ซึ่งเป็นพฤติกรรมมาตรฐาน
 * ของช่องกรอกแบบมีรายการเลือก (ช่องที่กำลังพิมพ์และรายการยังเข้าถึงได้ตามปกติ)
 */
async function fillSuggestion(field: ReturnType<typeof symbol>, page: Page, value: string) {
  await field.fill(value)
  await page.keyboard.press("Escape")
}

async function fillPortfolio(page: Page, rows: Array<[string, string]>) {
  for (const [index, [sym, w]] of rows.entries()) {
    await fillSuggestion(symbol(page, index), page, sym)
    await weight(page, index).fill(w)
  }
}

test.describe("US-05 ฟอร์มตั้งค่าพอร์ต", () => {
  test("AC-CFG-01 ค่าเริ่มต้นครบตามการ์ด", async ({ page }) => {
    await page.goto("/backtest")

    await expect(symbol(page, 0)).toHaveValue("")
    await expect(symbol(page, 1)).toHaveValue("")
    await expect(page.locator("#amount")).toHaveValue("10000")
    await expect(page.locator("#benchmark")).toHaveValue("SPY")
    await expect(page.locator("#endYear")).toHaveValue("2026")
    await expect(page.locator("#startYear")).toHaveValue("2016")
    await expect(submit(page)).toBeEnabled()
    // หน่วยเงินกำกับตาม BR-MVP-04 และคำเตือนตาม BR-MVP-02
    await expect(page.getByText("ดอลลาร์สหรัฐ")).toBeVisible()
    await expect(page.getByText("ผลตอบแทนในอดีตไม่ได้รับประกัน", { exact: false })).toBeVisible()

    await page.screenshot({ path: `${EVIDENCE}/form-empty-light.png`, fullPage: true })
  })

  test("AC-CFG-02 ฟอร์มถูกต้องแล้วรันได้ และลิงก์เปลี่ยนตามค่า", async ({ page }) => {
    await page.goto("/backtest")
    await fillPortfolio(page, [
      ["VTI", "60"],
      ["BND", "40"],
    ])
    await submit(page).click()

    await expect(page).toHaveURL(/assets=VTI:60,BND:40/)
    await expect(page).toHaveURL(/amount=10000/)
    await expect(resultsReady(page)).toBeVisible({ timeout: 10_000 })
    await page.screenshot({ path: `${EVIDENCE}/run-success-light.png`, fullPage: true })
  })

  test("AC-CFG-03..09 ข้อความตรวจสอบครบตามทะเบียน", async ({ page }) => {
    await page.goto("/backtest")

    // V-002 ยังไม่กรอกสัญลักษณ์เลย
    await submit(page).click()
    await expect(page.getByText("เพิ่มสินทรัพย์อย่างน้อย 1 ตัวก่อนเริ่มทดสอบ")).toBeVisible()

    // V-001 น้ำหนักรวมไม่ครบ
    await fillPortfolio(page, [
      ["VTI", "60"],
      ["BND", "30"],
    ])
    await submit(page).click()
    await expect(
      page.getByText("น้ำหนักรวมของพอร์ตต้องเท่ากับ 100% ตอนนี้รวมได้ 90%"),
    ).toBeVisible()

    // V-007 น้ำหนักนอกช่วง
    await weight(page, 1).fill("150")
    await submit(page).click()
    await expect(page.getByText("น้ำหนักแต่ละตัวต้องเป็นตัวเลขระหว่าง 0 ถึง 100")).toBeVisible()

    // V-010 สัญลักษณ์ซ้ำ
    await weight(page, 1).fill("40")
    await fillSuggestion(symbol(page, 1), page, "VTI")
    await submit(page).click()
    await expect(page.getByText("สัญลักษณ์นี้มีอยู่ในพอร์ตแล้ว")).toBeVisible()

    // V-003 สัญลักษณ์ที่ไม่มีข้อมูล (ตรวจตอนออกจากช่อง)
    await symbol(page, 1).fill("ZZZZZ")
    await symbol(page, 1).blur()
    await expect(page.getByText("ไม่พบข้อมูลของ ZZZZZ ตรวจสอบตัวสะกดอีกครั้ง")).toBeVisible({
      timeout: 10_000,
    })

    // V-006 เงินตั้งต้นเป็น 0
    await fillSuggestion(symbol(page, 1), page, "BND")
    await page.locator("#amount").fill("0")
    await submit(page).click()
    await expect(page.getByText("เงินตั้งต้นต้องเป็นตัวเลขที่มากกว่า 0")).toBeVisible()

    // V-004 ปีสลับกัน
    await page.locator("#amount").fill("10000")
    await fillSuggestion(page.locator("#startYear"), page, "2020")
    await fillSuggestion(page.locator("#endYear"), page, "2015")
    await submit(page).click()
    await expect(page.getByText("ปีเริ่มต้นต้องไม่มากกว่าปีสิ้นสุด")).toBeVisible()

    // V-005 ปีสิ้นสุดเกินข้อมูลที่มี (พิมพ์ปีนอกรายการเองได้)
    await fillSuggestion(page.locator("#startYear"), page, "2015")
    await fillSuggestion(page.locator("#endYear"), page, "2030")
    await submit(page).click()
    await expect(
      page.getByText("เลือกช่วงเวลาได้ถึง มิถุนายน 2026 ซึ่งเป็นเดือนล่าสุดที่มีข้อมูลครบ"),
    ).toBeVisible()

    await page.screenshot({ path: `${EVIDENCE}/form-errors-light.png`, fullPage: true })
  })

  test("AC-CFG-11 ปุ่มเฉลี่ยน้ำหนักทำให้รวมได้ 100 พอดี", async ({ page }) => {
    await page.goto("/backtest")
    await page.getByRole("button", { name: "เพิ่มสินทรัพย์" }).click()
    await fillPortfolio(page, [
      ["VTI", ""],
      ["BND", ""],
      ["VXUS", ""],
    ])
    await page.getByRole("button", { name: "เฉลี่ยน้ำหนักเท่ากัน" }).click()

    await expect(weight(page, 0)).toHaveValue("33.34")
    await expect(weight(page, 1)).toHaveValue("33.33")
    await expect(weight(page, 2)).toHaveValue("33.33")

    await submit(page).click()
    await expect(resultsReady(page)).toBeVisible({ timeout: 10_000 })
  })

  test("AC-CFG-14 ลบแถวสุดท้ายไม่ได้ และเพิ่มได้ไม่เกิน 10 แถว", async ({ page }) => {
    await page.goto("/backtest")
    const removeButtons = page.getByRole("button", { name: "ลบสินทรัพย์แถวนี้" })
    await removeButtons.first().click()
    await expect(removeButtons.first()).toBeDisabled()

    const addButton = page.getByRole("button", { name: "เพิ่มสินทรัพย์" })
    for (let i = 1; i < 10; i++) await addButton.click()
    await expect(addButton).toBeDisabled()
  })

  test("AC-CFG-12 สลับภาษากลางฟอร์มแล้วค่าที่กรอกไม่หาย", async ({ page }) => {
    await page.goto("/backtest")
    await fillPortfolio(page, [["VTI", "60"]])

    await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()
    await expect(page.getByText("Set up the portfolio to test")).toBeVisible()
    await expect(symbol(page, 0)).toHaveValue("VTI")
    await expect(weight(page, 0)).toHaveValue("60")
  })

  test("AC-CFG-13 กดรันซ้ำระหว่างกำลังทำงาน ปุ่มถูกปิด", async ({ page }) => {
    await page.goto("/backtest")
    await fillPortfolio(page, [
      ["VTI", "60"],
      ["BND", "40"],
    ])
    await submit(page).click()
    // ระหว่างทำงานปุ่มเปลี่ยนข้อความและกดไม่ได้
    const busy = page.getByRole("button", { name: "กำลังทดสอบ" })
    if (await busy.count()) await expect(busy).toBeDisabled()
    await expect(resultsReady(page)).toBeVisible({ timeout: 10_000 })
  })
})

test.describe("US-06 ค่าที่ตั้งไว้อยู่ในลิงก์", () => {
  test("AC-URL-02 เปิดลิงก์ครบ ฟอร์มถูกเติมและรันเองโดยไม่ต้องกด", async ({ page }) => {
    await page.goto(FULL_LINK)

    await expect(symbol(page, 0)).toHaveValue("VTI")
    await expect(weight(page, 0)).toHaveValue("60")
    await expect(symbol(page, 1)).toHaveValue("BND")
    await expect(page.locator("#startYear")).toHaveValue("2015")
    await expect(resultsReady(page)).toBeVisible({ timeout: 10_000 })
  })

  test("AC-URL-03 รีเฟรชแล้วค่าและผลยังอยู่", async ({ page }) => {
    await page.goto(FULL_LINK)
    await expect(resultsReady(page)).toBeVisible({ timeout: 10_000 })
    const before = await page.getByTestId("portfolio-endBalance").textContent()

    await page.reload()
    await expect(symbol(page, 0)).toHaveValue("VTI")
    await expect(page.getByTestId("portfolio-endBalance")).toHaveText(before ?? "", {
      timeout: 10_000,
    })
  })

  test("AC-URL-05/06 ลิงก์โครงสร้างเสียแจ้ง V-008 แล้วแก้ต่อได้", async ({ page }) => {
    await page.goto("/backtest?assets=VTI:abc")

    await expect(
      page.getByText("ลิงก์นี้มีค่าตั้งต้นไม่ครบหรือไม่ถูกต้อง กรุณาตั้งค่าพอร์ตใหม่"),
    ).toBeVisible()

    // แก้ในฟอร์มแล้วรันต่อได้ทันที
    await fillPortfolio(page, [
      ["VTI", "60"],
      ["BND", "40"],
    ])
    await submit(page).click()
    await expect(resultsReady(page)).toBeVisible({ timeout: 10_000 })
  })

  test("EC-URL-02 ลิงก์ที่อ่านออกแต่ผิดกฎฟอร์ม แจ้งข้อความรายช่อง ไม่ใช่ V-008", async ({ page }) => {
    await page.goto("/backtest?assets=VTI:60,BND:30&start=2015&end=2025")

    await expect(
      page.getByText("น้ำหนักรวมของพอร์ตต้องเท่ากับ 100% ตอนนี้รวมได้ 90%"),
    ).toBeVisible()
    await expect(
      page.getByText("ลิงก์นี้มีค่าตั้งต้นไม่ครบหรือไม่ถูกต้อง"),
    ).toHaveCount(0)
  })

  test("AC-URL-09 กดย้อนกลับหลังรันสองพอร์ต กลับไปพอร์ตแรก", async ({ page }) => {
    await page.goto("/backtest")
    await fillPortfolio(page, [
      ["VTI", "60"],
      ["BND", "40"],
    ])
    await submit(page).click()
    await expect(page).toHaveURL(/assets=VTI:60,BND:40/)
    await expect(resultsReady(page)).toBeVisible({ timeout: 10_000 })

    await weight(page, 0).fill("70")
    await weight(page, 1).fill("30")
    await submit(page).click()
    await expect(page).toHaveURL(/assets=VTI:70,BND:30/)

    await page.goBack()
    await expect(page).toHaveURL(/assets=VTI:60,BND:40/)
    await expect(weight(page, 0)).toHaveValue("60")
  })

  test("AC-SUM-06 สัญลักษณ์ที่ติดต่อแหล่งข้อมูลไม่ได้ แสดง E-001 พร้อมปุ่มลองใหม่", async ({ page }) => {
    await page.goto("/backtest?assets=ERRNET:100&start=2015&end=2025")

    await expect(page.getByText("โหลดข้อมูลราคาไม่สำเร็จ ลองใหม่อีกครั้ง")).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole("button", { name: "ลองใหม่" })).toBeVisible()
    await page.screenshot({ path: `${EVIDENCE}/run-error-light.png`, fullPage: true })
  })

  test("N-001 ช่วงถูกย่อตามข้อมูลที่มี", async ({ page }) => {
    await page.goto("/backtest?assets=NEWFUND:50,VTI:50&start=2012&end=2026")

    await expect(resultsReady(page)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("ช่วงเวลาถูกปรับเป็น", { exact: false })).toBeVisible()
  })
})

test.describe("การแสดงผลในสภาพแวดล้อมจริง", () => {
  test("ปุ่มสลับโหมด ค่าเริ่มต้นสว่าง และจอแคบ", async ({ page, browser }) => {
    await page.goto(FULL_LINK)
    await expect(resultsReady(page)).toBeVisible({ timeout: 10_000 })

    // ค่าเริ่มต้นคือโหมดสว่างเสมอ ไม่ขึ้นกับการตั้งค่าของเครื่อง
    await expect(page.locator("html")).not.toHaveClass(/dark/)

    const themeToggle = page.getByRole("button", { name: "สลับโหมดสว่างและมืด" })
    await themeToggle.click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.screenshot({ path: `${EVIDENCE}/run-success-dark.png`, fullPage: true })

    // เลือกไว้แล้วต้องจำได้เมื่อเปิดหน้าใหม่
    await page.reload()
    await expect(page.locator("html")).toHaveClass(/dark/)

    await themeToggle.click()
    await expect(page.locator("html")).not.toHaveClass(/dark/)

    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto(FULL_LINK)
    await expect(resultsReady(mobilePage)).toBeVisible({ timeout: 10_000 })

    const overflow = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, "หน้าเว็บต้องไม่เลื่อนแนวนอนบนจอแคบ").toBeLessThanOrEqual(0)

    await mobilePage.screenshot({ path: `${EVIDENCE}/run-success-mobile.png`, fullPage: true })
    await mobile.close()
  })
})
