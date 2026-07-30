import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-13 + US-14 — สกุลเงินฐานและหุ้นไทยบนหน้าจอจริง
 *
 * เทสต์ที่สำคัญที่สุดในไฟล์นี้คือ "ลิงก์เก่าให้ค่าเดิม" เพราะเป็นความเสียหายร้ายแรงที่สุด
 * ที่รอบนี้ทำได้ — ลิงก์ที่แชร์ออกไปแล้วต้องไม่เปลี่ยนความหมาย
 */
const EVIDENCE = "artifacts/evidence/S11"
const PERIOD = "start=2015&end=2025&amount=350000"
const COMMON = `${PERIOD}&benchmark=SPY`
/** ลิงก์รูปแบบเดียวกับที่บันทึกไว้ในหลักฐานของ S8 — ไม่มีค่าสกุลเงิน */
const LEGACY_LINK = "/backtest?assets=VTI:60,BND:40&start=2015&end=2025&amount=10000&benchmark=SPY"

const ready = (page: Page) => page.getByTestId("portfolio-endBalance")
const convertedNotice = (page: Page) => page.getByText("แปลงค่าเงิน", { exact: false })

test.describe("US-13 เลือกสกุลเงินฐาน", () => {
  test("BR-CUR-01 ฟอร์มเปล่าเริ่มที่เงินบาท และป้ายหน่วยตรงกัน", async ({ page }) => {
    await page.goto("/backtest")
    await expect(page.locator("#baseCurrency")).toHaveValue("THB")
    await expect(page.locator("label[for=amount]")).toContainText("บาท")
  })

  test("AC-CUR-02 ฐานเงินบาท ทุกจุดที่แสดงจำนวนเงินใช้สัญลักษณ์บาท", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:100&${COMMON}&base=THB`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    // จุดที่ 1 ตารางสรุป
    await expect(ready(page)).toContainText("฿")
    await expect(page.getByTestId("portfolio-startAmount")).toContainText("฿")

    // จุดที่ 2 ตารางมูลค่าสิ้นปีของกราฟ
    await page.getByRole("group").filter({ hasText: "ดูเป็นตาราง" }).locator("summary").click()
    await expect(page.getByTestId("year-end-2025")).toContainText("฿")

    // จุดที่ 3 แกนตั้งของกราฟ
    await expect(page.getByTestId("growth-chart")).toContainText("฿")

    // ไม่มีสัญลักษณ์ดอลลาร์หลงเหลือในส่วนผลลัพธ์
    await expect(page.getByTestId("summary-rows")).not.toContainText("$")
  })

  test("BR-CUR-05 บอกผู้ใช้เมื่อมีการแปลงค่าเงิน และไม่บอกเมื่อไม่มี", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:100&${COMMON}&base=THB`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(convertedNotice(page)).toBeVisible()

    await page.goto(`/backtest?assets=PTT.BK:50,CPALL.BK:50&${PERIOD}&benchmark=AOT.BK&base=THB`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(convertedNotice(page)).toHaveCount(0)
  })

  test("AC-CUR-03 สลับสกุลเงินแล้วค่าและหน่วยเปลี่ยนครบ", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:100&${COMMON}&base=THB`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    const inBaht = await ready(page).textContent()

    // ปิดรายการเลือกก่อน เพราะระหว่างเปิดอยู่ ส่วนที่เหลือของฟอร์มถูกกันไว้จากโปรแกรมอ่านหน้าจอ
    await page.locator("#baseCurrency").fill("USD")
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "เริ่มทดสอบ", exact: true }).click()
    await expect(ready(page)).toContainText("$", { timeout: 30_000 })

    expect(await ready(page).textContent()).not.toBe(inBaht)
    await expect(page).toHaveURL(/base=USD/)
  })

  test("BR-CUR-03 ลิงก์เก่าที่ไม่มีสกุลเงิน ต้องให้ค่าเดิมทุกหลัก", async ({ page }) => {
    await page.goto(LEGACY_LINK)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    // ค่าที่บันทึกไว้ในหลักฐานของ S8 ก่อนมีตัวเลือกสกุลเงิน
    await expect(page.getByTestId("portfolio-cagr")).toHaveText("8.64%")
    await expect(ready(page)).toHaveText("$24,884")
  })

  test("EC-CUR-01 สกุลเงินที่ไม่รู้จักในลิงก์ แจ้ง V-008 แล้วแก้ต่อได้", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:100&${COMMON}&base=EUR`)
    await expect(page.getByText("ลิงก์นี้มีค่าตั้งต้นไม่ครบหรือไม่ถูกต้อง")).toBeVisible()
    await expect(page.locator("#p0-symbol-0")).toHaveValue("VTI")
  })
})

test.describe("US-14 หุ้นไทยใช้ได้เต็มรูปแบบ", () => {
  test("AC-SET-01 รายการแนะนำแบ่งกลุ่มและมีหุ้นไทยครบห้าตัว", async ({ page }) => {
    await page.goto("/backtest")
    await page.locator("#p0-symbol-0").click()

    const options = page.getByRole("option")
    await expect(options.filter({ hasText: ".BK" })).toHaveCount(5)
    await expect(options.filter({ hasText: "หุ้นไทย" }).first()).toBeVisible()
    await expect(options.filter({ hasText: "สินทรัพย์ต่างประเทศ" }).first()).toBeVisible()
  })

  test("AC-SET-02 เลือกหุ้นไทยจากรายการแล้วรันได้", async ({ page }) => {
    await page.goto("/backtest")
    await page.locator("#p0-symbol-0").fill("PTT.BK")
    await page.locator("#p0-weight-0").fill("100")
    await page.getByRole("button", { name: "เริ่มทดสอบ", exact: true }).click()
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
  })

  test("AC-SET-06/07 หน้าแรกมีพอร์ตหุ้นไทย กดแล้วได้ผลทันทีโดยไม่มีข้อความเตือน", async ({ page }) => {
    await page.goto("/")
    const cards = page.locator("main a[href^='/backtest?']")
    await expect(cards).toHaveCount(4)

    const thaiCard = cards.filter({ hasText: "หุ้นไทยกับตลาดโลก" })
    await expect(thaiCard).toBeVisible()
    await thaiCard.click()

    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(ready(page)).toContainText("฿")
    // ต้องไม่มีข้อความว่าช่วงเวลาถูกย่อ (BR-DMO-08 / BR-SET-05)
    await expect(page.getByText("ช่วงเวลาถูกปรับเป็น", { exact: false })).toHaveCount(0)
  })

  test("AC-SET-08 สลับภาษาแล้วชื่อพอร์ตตัวอย่างเปลี่ยน แต่สัญลักษณ์คงเดิม", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()

    const cards = page.locator("main a[href^='/backtest?']")
    await expect(cards.filter({ hasText: "Thai stocks and the world" })).toBeVisible()
    await expect(cards.filter({ hasText: "PTT.BK" })).toBeVisible()
  })
})

test.describe("สกุลเงินในสภาพแวดล้อมจริง", () => {
  test("โหมดมืดและจอแคบ", async ({ page, browser }) => {
    await page.goto(`/backtest?assets=PTT.BK:30,CPALL.BK:30,VTI:40&${COMMON}&base=THB`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await page.screenshot({ path: `${EVIDENCE}/mixed-thb-light.png`, fullPage: true })

    await page.getByRole("button", { name: "สลับโหมดสว่างและมืด" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.screenshot({ path: `${EVIDENCE}/mixed-thb-dark.png`, fullPage: true })

    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto(`/backtest?assets=PTT.BK:100&${COMMON}&base=THB`)
    await expect(mobilePage.getByTestId("portfolio-endBalance")).toBeVisible({ timeout: 30_000 })

    const overflow = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, "หน้าเว็บต้องไม่เลื่อนแนวนอนบนจอแคบ").toBeLessThanOrEqual(0)
    await mobilePage.screenshot({ path: `${EVIDENCE}/mixed-thb-mobile.png`, fullPage: true })
    await mobile.close()
  })
})
