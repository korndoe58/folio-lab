import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-25 (กล่องเลือกอ่านออก) · US-26 (ลำดับชั้นของฟอร์ม) · US-27 (จังหวะข้อความตรวจสอบ)
 *
 * เทสต์ที่สำคัญที่สุดของไฟล์นี้คือคู่ของ US-27 — **ข้อความที่แก้ถูกแล้วต้องหาย** และ
 * **ข้อความใหม่ต้องไม่โผล่ระหว่างพิมพ์** · ทำได้ข้อเดียวคือแก้ปัญหาหนึ่งแล้วสร้างอีกปัญหา
 * ([PD-018](../docs/product/decision-log.md))
 */
const EVIDENCE = "artifacts/evidence/S16c"

const openPopup = (page: Page) => page.locator('[data-slot="combobox-content"][data-open]')
const groupLabels = (page: Page) => page.locator('[data-slot="combobox-label"]')
const symbolField = (page: Page) => page.locator("#p0-symbol-0")
const submit = (page: Page) => page.getByRole("button", { name: "เริ่มทดสอบ", exact: true })
const weightMessage = (page: Page) => page.getByText(/น้ำหนักรวมของพอร์ตต้องเท่ากับ 100%/)
const amountMessage = (page: Page) => page.getByText(/เงินตั้งต้นต้องเป็นตัวเลขที่มากกว่า 0/)
/** หัวข้อของแต่ละกรอบในฟอร์ม — ผูกกับฟอร์มโดยตรง ไม่ใช่ `legend` ตัวไหนก็ได้ในหน้า */
const legends = (page: Page) => page.getByTestId("portfolio-form").locator("legend")

/**
 * ตัวเลือกวางกี่บรรทัดจริง ๆ — วัดจากตำแหน่งของสองข้อความในตัวเลือก
 *
 * ใช้เรขาคณิตแทนการดูขึ้นบรรทัดใหม่ในข้อความ เพราะ `innerText` แทรกบรรทัดใหม่ระหว่าง span
 * เสมอไม่ว่าจะวางเรียงกันหรือซ้อนกัน — สิ่งที่ AC พูดถึงคือสิ่งที่ผู้ใช้เห็น
 */
async function itemLines(item: ReturnType<Page["locator"]>): Promise<number> {
  const spans = item.locator("span")
  const [first, second] = await Promise.all([
    spans.nth(0).boundingBox(),
    spans.nth(1).boundingBox(),
  ])
  if (!second) return 1
  return Math.abs(first!.y - second.y) > 2 ? 2 : 1
}

/** พอร์ตหนึ่งสินทรัพย์ที่น้ำหนักรวมยังไม่ครบ — สถานะตั้งต้นของเทสต์ฝั่ง US-27 */
async function fillUnderweightPortfolio(page: Page) {
  await symbolField(page).fill("VTI")
  await page.keyboard.press("Escape")
  await page.locator("#p0-weight-0").fill("60")
  await page.locator("#p0-symbol-1").fill("")
}

test.describe("US-27 จังหวะที่ข้อความตรวจสอบโผล่และหาย", () => {
  test("AC-FRM-12 ก่อนกดรันครั้งแรก ฟอร์มเงียบสนิท", async ({ page }) => {
    await page.goto("/backtest")
    await fillUnderweightPortfolio(page)
    // น้ำหนักรวมได้ 60 ซึ่งผิดกฎ แต่ยังไม่กดรัน จึงต้องไม่มีข้อความ
    await expect(weightMessage(page)).toHaveCount(0)
  })

  test("AC-FRM-13 · AC-FRM-14 กดรันแล้วขึ้นข้อความ แก้ถูกแล้วหายทันทีโดยไม่ต้องกดรัน", async ({
    page,
  }) => {
    await page.goto("/backtest")
    await fillUnderweightPortfolio(page)
    await submit(page).click()
    await expect(weightMessage(page)).toBeVisible()

    // ★ แก้ให้ถูกแล้วต้องหายเอง ไม่ต้องกดรันเพื่อถามระบบ
    await page.locator("#p0-weight-0").fill("100")
    await expect(weightMessage(page)).toHaveCount(0)
  })

  test("AC-FRM-15 ยังไม่ถูก ข้อความอยู่ต่อพร้อมค่าล่าสุด", async ({ page }) => {
    await page.goto("/backtest")
    await fillUnderweightPortfolio(page)
    await submit(page).click()
    await expect(weightMessage(page)).toContainText("รวมได้ 60%")

    await page.locator("#p0-weight-0").fill("70")
    await expect(weightMessage(page)).toContainText("รวมได้ 70%")
  })

  test("AC-FRM-16 · AC-FRM-18 ปัญหาใหม่ระหว่างพิมพ์ไม่โผล่ แต่โผล่ตอนกดรัน", async ({ page }) => {
    await page.goto("/backtest")
    await fillUnderweightPortfolio(page)
    await submit(page).click()
    await expect(weightMessage(page)).toBeVisible()

    // ลบเงินตั้งต้นจนว่าง — ช่องนี้เดิมไม่มีปัญหา จึงต้องเงียบระหว่างพิมพ์
    await page.locator("#amount").fill("")
    await expect(amountMessage(page)).toHaveCount(0)

    // แต่พอกดรัน ข้อความของช่องนั้นต้องโผล่
    await submit(page).click()
    await expect(amountMessage(page)).toBeVisible()
  })

  test("AC-FRM-17 แก้จนไม่เหลือปัญหาแล้วกดรัน ได้ผลตามปกติ", async ({ page }) => {
    await page.goto("/backtest")
    await fillUnderweightPortfolio(page)
    await submit(page).click()
    await expect(weightMessage(page)).toBeVisible()

    await page.locator("#p0-weight-0").fill("100")
    await submit(page).click()
    await expect(page.getByTestId("portfolio-endBalance")).toBeVisible()
  })

  test("EC-FRM-12 แก้ช่องหนึ่งถูก อีกช่องที่ยังผิดยังอยู่", async ({ page }) => {
    await page.goto("/backtest")
    await fillUnderweightPortfolio(page)
    await page.locator("#amount").fill("0")
    await submit(page).click()
    await expect(weightMessage(page)).toBeVisible()
    await expect(amountMessage(page)).toBeVisible()

    await page.locator("#p0-weight-0").fill("100")
    await expect(weightMessage(page)).toHaveCount(0)
    await expect(amountMessage(page), "ช่องที่ยังผิดต้องอยู่ต่อ").toBeVisible()
  })
})

test.describe("US-25 กล่องเลือกอ่านออกบนจอแคบ", () => {
  test("AC-FRM-01 จอ 375 จุด ป๊อปอัพกว้างอย่างน้อย 300 จุดและไม่ล้นจอ", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto("/backtest")
    await symbolField(page).click()
    await groupLabels(page).first().waitFor()

    const box = await openPopup(page).boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(300)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `${EVIDENCE}/picker-375.png` })
  })

  test("AC-FRM-02 สัญลักษณ์กับคำอธิบายอยู่คนละบรรทัด", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto("/backtest")
    await symbolField(page).click()
    await groupLabels(page).first().waitFor()
    await symbolField(page).fill("GPSC")

    const item = page.locator('[data-slot="combobox-item"]').first()
    expect(await itemLines(item), "สัญลักษณ์กับคำอธิบายต้องคนละบรรทัด").toBe(2)
    await expect(item).toContainText("ข้อมูลจาก 2015")
  })

  test("AC-FRM-03 จอกว้างก็เป็นสองบรรทัดเหมือนกัน", async ({ page }) => {
    await page.goto("/backtest")
    await symbolField(page).click()
    await groupLabels(page).first().waitFor()
    await symbolField(page).fill("GPSC")

    expect(await itemLines(page.locator('[data-slot="combobox-item"]').first())).toBe(2)
  })

  test("AC-FRM-04 ช่องสกุลเงินและช่องปียังเป็นรายการบรรทัดเดียวเหมือนเดิม", async ({ page }) => {
    await page.goto("/backtest")
    await page.locator("#baseCurrency").click()
    await expect(groupLabels(page)).toHaveCount(0)

    // ยังเรียงกันในบรรทัดเดียวเหมือนเดิม ไม่ถูกดึงไปใช้กติกาของรายการแบ่งหมวด
    expect(await itemLines(page.locator('[data-slot="combobox-item"]').first())).toBe(1)
  })

  test("AC-FRM-05 พฤติกรรมการกรองและการเลือกไม่เปลี่ยน", async ({ page }) => {
    await page.goto("/backtest")
    await symbolField(page).click()
    await groupLabels(page).first().waitFor()
    await symbolField(page).fill("PTT")

    await expect(groupLabels(page)).toHaveCount(1)
    await page.locator('[data-slot="combobox-item"]').first().click()
    await expect(symbolField(page)).toHaveValue("PTT.BK")
  })

  test("EC-FRM-02 จอ 320 จุดยังไม่ล้น", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto("/backtest")
    await symbolField(page).click()
    await groupLabels(page).first().waitFor()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})

test.describe("US-26 ลำดับชั้นของฟอร์ม", () => {
  test("AC-FRM-06 · AC-FRM-07 โหมดพอร์ตเดียวมีสองกรอบพร้อมหัวข้อ", async ({ page }) => {
    await page.goto("/backtest")
    await symbolField(page).waitFor()

    await expect(page.locator("form fieldset.rounded-lg.border")).toHaveCount(2)
    await expect(legends(page)).toHaveText(["สินทรัพย์ในพอร์ต", "ช่วงเวลาและเงินตั้งต้น"])
    // คำว่า "ทุกพอร์ต" ต้องไม่โผล่ในโหมดพอร์ตเดียว
    await expect(legends(page).filter({ hasText: "ทุกพอร์ต" })).toHaveCount(0)
  })

  test("AC-FRM-08 เพิ่มพอร์ตแล้วหัวข้อค่าร่วมเปลี่ยน ลบกลับแล้วเปลี่ยนกลับ", async ({ page }) => {
    await page.goto("/backtest")
    await page.getByRole("button", { name: "เพิ่มพอร์ตเทียบ" }).click()
    await page.locator("#p1-symbol-0").waitFor()

    await expect(legends(page)).toHaveText(["พอร์ต 1", "พอร์ต 2", "ค่าที่ใช้ร่วมกันทุกพอร์ต"])

    await page.getByRole("button", { name: /ลบพอร์ต 2/ }).click()
    await expect(legends(page)).toHaveText(["สินทรัพย์ในพอร์ต", "ช่วงเวลาและเงินตั้งต้น"])
  })

  test("EC-FRM-08 หัวข้อมีคำแปลครบทั้งสองภาษา", async ({ page }) => {
    await page.goto("/backtest")
    await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()

    await expect(legends(page)).toHaveText(["Portfolio holdings", "Period and starting amount"])
  })

  test("AC-FRM-10 id ของทุกช่องยังเหมือนเดิม", async ({ page }) => {
    await page.goto("/backtest")
    // ชุดเดียวกับที่ลิงก์ หลักฐาน และชุดทดสอบเดิมพึ่งพา (BR-FRM-02)
    for (const id of [
      "#p0-symbol-0",
      "#p0-weight-0",
      "#p0-rebalance",
      "#p0-cashflow",
      "#amount",
      "#baseCurrency",
      "#benchmark",
      "#startYear",
      "#endYear",
      "#inflationAdjusted",
    ]) {
      await expect(page.locator(id), id).toHaveCount(1)
    }
  })

  test("AC-FRM-11 จอ 375 จุด กรอบอ่านออกและหน้าไม่เลื่อนแนวนอน", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto("/backtest")
    await symbolField(page).waitFor()

    await expect(legends(page).first()).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `${EVIDENCE}/hierarchy-375.png`, fullPage: true })
  })

  test("สองธีม", async ({ page }) => {
    await page.goto("/backtest")
    await symbolField(page).waitFor()
    await page.screenshot({ path: `${EVIDENCE}/form-light.png`, fullPage: true })

    await page.emulateMedia({ colorScheme: "dark" })
    await page.reload()
    await symbolField(page).waitFor()
    await page.screenshot({ path: `${EVIDENCE}/form-dark.png`, fullPage: true })
  })
})
