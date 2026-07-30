import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-23 (แคตตาล็อก 100 ตัว) + US-24 (รายการแนะนำแบ่งหมวด)
 *
 * เทสต์ที่สำคัญที่สุดสองข้อ:
 * · **เลือก `ADVANC.BK` แล้วรันได้จริง** — ตัวนี้อยู่ในรายการแนะนำมาตั้งแต่ S11 แต่ไม่มีชุดจำลอง
 *   จึงเลือกแล้วขึ้นว่าไม่พบข้อมูลมาสองเฟส · ข้อนี้คือตัวที่ปิดหนี้นั้น
 * · **พิมพ์กรองแล้วหมวดที่ไม่เหลือตัวเลือกต้องหายไปทั้งหัวข้อ** — ไม่ใช่ค้างเป็นหัวข้อเปล่า
 */
const EVIDENCE = "artifacts/evidence/S16b"
const SHARED = "start=2015&end=2025&amount=10000&benchmark=SPY&base=USD"

const groupLabels = (page: Page) => page.locator('[data-slot="combobox-label"]')
const items = (page: Page) => page.locator('[data-slot="combobox-item"]')
const symbolField = (page: Page) => page.locator("#p0-symbol-0")
const submit = (page: Page) => page.getByRole("button", { name: "เริ่มทดสอบ", exact: true })

/** เปิดกล่องแล้วรอให้หัวข้อหมวดแรกโผล่ */
async function openPicker(page: Page) {
  await symbolField(page).click()
  await groupLabels(page).first().waitFor()
}

test.describe("US-23 แคตตาล็อกสินทรัพย์ 100 ตัว", () => {
  test("AC-CAT-01 รายการมี 100 ตัวครบทั้งฝั่งไทยและต่างประเทศ", async ({ page }) => {
    await page.goto("/backtest")
    await openPicker(page)

    await expect(items(page)).toHaveCount(100)
    // มีหมวดจากทั้งสองฝั่ง ไม่ใช่ฝั่งเดียว
    await expect(groupLabels(page).filter({ hasText: "ธนาคารและการเงิน" })).toHaveCount(1)
    await expect(groupLabels(page).filter({ hasText: "หุ้นสหรัฐทั้งตลาด" })).toHaveCount(1)
    await expect(groupLabels(page).filter({ hasText: "คริปโท" })).toHaveCount(1)
  })

  test("AC-CAT-05 เลือก ADVANC.BK แล้วรันได้จริง ไม่ขึ้นว่าไม่พบข้อมูล", async ({ page }) => {
    // ★ หนี้ที่ค้างมาตั้งแต่ S11 — อยู่ในรายการแนะนำแต่โหมดจำลองไม่มีชุดข้อมูล
    await page.goto("/backtest")
    await symbolField(page).fill("ADVANC.BK")
    await page.keyboard.press("Escape")
    await page.locator("#p0-weight-0").fill("100")
    await page.locator("#p0-symbol-1").fill("")
    await submit(page).click()

    await expect(page.getByTestId("portfolio-endBalance")).toBeVisible()
    await expect(page.getByText(/ไม่พบข้อมูลของ/)).toHaveCount(0)
  })

  test("AC-CAT-05 KBANK.BK ก็ใช้ได้เช่นกัน", async ({ page }) => {
    await page.goto(`/backtest?assets=KBANK.BK:100&${SHARED}`)
    await expect(page.getByTestId("portfolio-endBalance")).toBeVisible()
    await expect(page.getByTestId("portfolio-cagr")).not.toHaveText("—")
  })

  test("AC-CAT-07 พิมพ์สัญลักษณ์นอกรายการยังใช้ได้", async ({ page }) => {
    // รายการเป็นทางลัด ไม่ใช่ข้อจำกัด (BR-CAT-08 · BR-SET-07 เดิม)
    await page.goto(`/backtest?assets=UPONLY:100&${SHARED}`)
    await expect(page.getByTestId("portfolio-endBalance")).toBeVisible()
  })

  test("สัญลักษณ์ที่ ship มาตั้งแต่แรกยังอยู่ครบ ลิงก์เก่าจึงไม่พัง", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:60,BND:40&${SHARED}`)
    await expect(page.getByTestId("portfolio-endBalance")).toHaveText("$24,884")
    await expect(page.getByTestId("portfolio-cagr")).toHaveText("8.64%")
  })
})

test.describe("US-24 รายการแนะนำแบ่งหมวด", () => {
  test("AC-CAT-09 กล่องที่กางลงมามีหัวข้อหมวดจริง ไม่ใช่รายการแบน", async ({ page }) => {
    await page.goto("/backtest")
    await openPicker(page)

    const labels = await groupLabels(page).allInnerTexts()
    expect(labels.length).toBeGreaterThanOrEqual(15)
    expect(labels).toContain("พลังงานและสาธารณูปโภค")
    expect(labels).toContain("พันธบัตร")
  })

  test("AC-CAT-10 พิมพ์กรองข้ามหมวด และหมวดที่ว่างหายไปทั้งหัวข้อ", async ({ page }) => {
    await page.goto("/backtest")
    await openPicker(page)
    await symbolField(page).fill("PTT")

    // เหลือเฉพาะหมวดที่ยังมีตัวเลือก
    await expect(groupLabels(page)).toHaveCount(1)
    await expect(groupLabels(page)).toHaveText("พลังงานและสาธารณูปโภค")
    const shown = await items(page).allInnerTexts()
    expect(shown.map((t) => t.split("\n")[0])).toEqual(["PTT.BK", "PTTEP.BK", "PTTGC.BK"])
  })

  test("EC-CAT-05 พิมพ์แล้วไม่เหลืออะไรเลย ไม่มีหัวข้อหมวดค้าง", async ({ page }) => {
    await page.goto("/backtest")
    await openPicker(page)
    await symbolField(page).fill("ZZZZ")

    await expect(groupLabels(page)).toHaveCount(0)
    await expect(items(page)).toHaveCount(0)
  })

  test("AC-CAT-11 · AC-CAT-12 ปีข้อมูลกำกับเฉพาะตัวที่เริ่มช้า", async ({ page }) => {
    await page.goto("/backtest")
    await openPicker(page)

    await symbolField(page).fill("SCB.BK")
    await expect(items(page).first()).toContainText("ข้อมูลจาก 2022")

    // ตัวที่ข้อมูลเต็มต้องไม่มีปีต่อท้าย ไม่งั้นกลายเป็นสัญญาณรบกวน
    await symbolField(page).fill("PTT.BK")
    await expect(items(page).first()).toContainText("ปตท.")
    await expect(items(page).first()).not.toContainText("ข้อมูลจาก")
  })

  test("AC-CAT-13 สินทรัพย์ข้อมูลสั้นย่อช่วงเวลา และบอกชื่อตัวที่จำกัดได้ถูก", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:50,BTC-USD:50&start=2012&end=2026&amount=10000&benchmark=SPY&base=USD`)
    await expect(page.getByTestId("portfolio-endBalance")).toBeVisible()

    // ★ ต้องบอกว่า BTC-USD เป็นตัวจำกัด ไม่ใช่ VTI ที่แค่จบท้ายช่วงพอดี
    await expect(page.getByText(/ช่วงเวลาถูกปรับเป็น .* ตามข้อมูลที่มีของ BTC-USD/)).toBeVisible()
    await expect(page.getByText(/รวม 141 เดือน/).first()).toBeVisible()
  })

  test("AC-CAT-14 ช่องสกุลเงินและช่องปียังเป็นรายการแบนเหมือนเดิม", async ({ page }) => {
    await page.goto("/backtest")

    await page.locator("#baseCurrency").click()
    await expect(items(page).first()).toBeVisible()
    await expect(groupLabels(page)).toHaveCount(0)
    await page.keyboard.press("Escape")

    await page.locator("#startYear").click()
    await expect(items(page).first()).toBeVisible()
    await expect(groupLabels(page)).toHaveCount(0)
  })

  test("AC-CAT-15 เดินด้วยแป้นพิมพ์ข้ามหมวดแล้วเลือกได้", async ({ page }) => {
    await page.goto("/backtest")
    await symbolField(page).click()
    await groupLabels(page).first().waitFor()

    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("Enter")

    // ได้ค่าจากรายการจริง ไม่ใช่ช่องว่าง
    await expect(symbolField(page)).not.toHaveValue("")
  })

  test("AC-CAT-16 จอ 375 จุด อ่านหมวดได้และหน้าไม่เลื่อนแนวนอน", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto("/backtest")
    await openPicker(page)

    await expect(groupLabels(page).first()).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `${EVIDENCE}/catalogue-mobile.png` })
  })

  test("สองธีม", async ({ page }) => {
    await page.goto("/backtest")
    await openPicker(page)
    await page.screenshot({ path: `${EVIDENCE}/catalogue-light.png` })

    await page.emulateMedia({ colorScheme: "dark" })
    await page.reload()
    await openPicker(page)
    await page.screenshot({ path: `${EVIDENCE}/catalogue-dark.png` })
  })
})
