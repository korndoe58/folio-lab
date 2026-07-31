import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-34 (ป้ายกำกับบนกราฟ) · US-35 (ปุ่มคืนค่าเริ่มต้น)
 *
 * สองเทสต์ที่สำคัญที่สุดในไฟล์นี้:
 * - **กดย้อนกลับแล้วได้ผลเดิมคืนมาครบ** — เป็นเหตุผลเดียวที่ปุ่มคืนค่าไม่ต้องมีกล่องยืนยัน
 *   ([PD-022](../docs/product/decision-log.md))
 * - **กด Enter ในช่องกรอกยังเริ่มทดสอบ** — การสลับลำดับปุ่มทำข้อนี้พังได้เงียบ ๆ
 */
const EVIDENCE = "artifacts/evidence/S17b"
const SHARED = "start=2015&end=2025&amount=10000&benchmark=SPY&base=USD"
const THREE = `p1=VTI:60,BND:40&p1.n=ผสม&p2=VTI:100&p2.n=หุ้นล้วน&p3=PTT.BK:100&${SHARED}`
const SOLO = `/backtest?assets=VTI:60,BND:40&${SHARED}`

const ready = (page: Page) => page.getByTestId("portfolio0-endBalance")
const soloReady = (page: Page) => page.getByTestId("portfolio-endBalance")
const submit = (page: Page) => page.getByRole("button", { name: "เริ่มทดสอบ", exact: true })
const reset = (page: Page) => page.getByRole("button", { name: "คืนค่าเริ่มต้น", exact: true })
const legendItems = (page: Page, id: string) => page.getByTestId(id).locator("li")

test.describe("US-34 ป้ายกำกับเส้นบนกราฟ", () => {
  test("AC-LOOP-01 + AC-LOOP-02 ป้ายมีครบทุกพอร์ตในกราฟทั้งสี่", async ({ page }) => {
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible()

    // สามกราฟที่วาดตัวเทียบด้วย
    for (const id of ["growth-legend", "drawdown-legend", "annual-legend"]) {
      await expect(legendItems(page, id)).toHaveText([
        "ผสม",
        "หุ้นล้วน",
        "พอร์ต 3",
        "ตลาด (SPY)",
      ])
    }

    // AC-LOOP-07 หน้าต่างเลื่อนไม่วาดตัวเทียบ ป้ายจึงไม่มีบรรทัดนั้น (BR-CMP-70)
    await expect(legendItems(page, "rolling-legend")).toHaveText(["ผสม", "หุ้นล้วน", "พอร์ต 3"])

    await page.screenshot({ path: `${EVIDENCE}/legend-three-portfolios.png`, fullPage: true })
  })

  test("AC-LOOP-03 ลายในป้ายตรงกับลายของเส้นในกราฟ", async ({ page }) => {
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible()

    // ค่าชุดนี้คือค่าที่ `series-style.ts` ให้ไว้ — ถ้าป้ายเขียนลายซ้ำเองจะหลุดจากกันทันที
    const dashes = await legendItems(page, "growth-legend")
      .locator("svg line")
      .evaluateAll((lines) => lines.map((l) => l.getAttribute("stroke-dasharray")))
    expect(dashes).toEqual([null, "10 4", "2 3", "5 4"])

    // เส้นของพอร์ตในกราฟจริงต้องใช้ลายชุดเดียวกัน
    const chartDashes = await page
      .getByTestId("growth-chart")
      .locator(".recharts-line-curve")
      .evaluateAll((paths) => paths.map((p) => p.getAttribute("stroke-dasharray")))
    // เส้นในกราฟ = พอร์ต 2, พอร์ต 3 แล้วตัวเทียบ (พอร์ตแรกเป็นเส้นทึบจึงไม่มี attribute)
    expect(chartDashes).toEqual(expect.arrayContaining(["10 4", "2 3", "5 4"]))
  })

  test("AC-LOOP-04 พอร์ตเดียวก็มีป้าย เพราะยังมีเส้นทึบกับเส้นประให้แยก", async ({ page }) => {
    await page.goto(SOLO)
    await expect(soloReady(page)).toBeVisible()

    await expect(legendItems(page, "growth-legend")).toHaveText(["พอร์ตของคุณ", "ตลาด (SPY)"])
  })

  test("AC-LOOP-05 บรรทัดเงินที่ใส่สะสมมีเฉพาะพอร์ตที่ตั้งเงินเข้าออกไว้", async ({ page }) => {
    // พอร์ต 2 ใส่เพิ่มเดือนละ 200 · พอร์ต 1 ไม่ได้ตั้ง
    await page.goto(`/backtest?p1=VTI:100&p1.n=ลงทีเดียว&p2=VTI:100&p2.n=ทยอย&p2.cf=200:m:in:fixed:prorata:flat&${SHARED}`)
    await expect(ready(page)).toBeVisible()

    await expect(legendItems(page, "growth-legend")).toHaveText([
      "ลงทีเดียว",
      "ทยอย",
      "เงินที่ใส่สะสมของทยอย",
      "ตลาด (SPY)",
    ])
  })

  test("AC-LOOP-06 ป้ายใช้ชื่อที่ผู้ใช้ตั้งเอง ตรงกับตารางสรุป", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:100&p1.n=หุ้นล้วน&p2=BND:100&p2.n=พันธบัตร&${SHARED}`)
    await expect(ready(page)).toBeVisible()

    await expect(legendItems(page, "growth-legend").first()).toHaveText("หุ้นล้วน")

    // ผูกกับตารางสรุปโดยตรง — ชื่อพอร์ตเป็นหัวคอลัมน์ในตารางรายปีด้วย การค้นแบบกว้าง
    // จึงเจอสองที่และล้มด้วยความกำกวม ไม่ใช่เพราะของพัง (บทเรียน ep#10/ep#31)
    const summaryTable = page.locator("table").filter({ has: page.getByTestId("summary-rows") })
    await expect(summaryTable.getByRole("columnheader", { name: "หุ้นล้วน" })).toBeVisible()
  })

  test("AC-LOOP-08 ตัวอย่างลายถูกซ่อนจากโปรแกรมอ่านหน้าจอ เหลือแต่ชื่อ", async ({ page }) => {
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible()

    const hidden = await legendItems(page, "growth-legend")
      .locator("svg")
      .evaluateAll((svgs) => svgs.map((s) => s.getAttribute("aria-hidden")))
    expect(hidden).toEqual(["true", "true", "true", "true"])
  })

  test("EC-LOOP-03 บนจอ 375 จุด ป้ายยังอ่านออกทุกบรรทัด", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible()

    const items = legendItems(page, "growth-legend")
    await expect(items).toHaveCount(4)
    for (let i = 0; i < 4; i++) {
      const box = await items.nth(i).boundingBox()
      expect(box!.width).toBeGreaterThan(0)
      // ไม่ล้นขอบจอ
      expect(box!.x + box!.width).toBeLessThanOrEqual(375)
    }

    await page.screenshot({ path: `${EVIDENCE}/legend-mobile.png`, fullPage: true })
  })
})

test.describe("US-35 ปุ่มคืนค่าเริ่มต้น", () => {
  test("AC-LOOP-09 คืนค่าเริ่มต้นซ้ายสุด เริ่มทดสอบชิดขวา อยู่บรรทัดเดียวกัน", async ({ page }) => {
    await page.goto("/backtest")

    const [resetBox, submitBox] = await Promise.all([
      reset(page).boundingBox(),
      submit(page).boundingBox(),
    ])
    expect(resetBox!.x).toBeLessThan(submitBox!.x)
    expect(Math.abs(resetBox!.y - submitBox!.y)).toBeLessThan(4)

    // ปุ่มคืนค่าต้องไม่ใช่ปุ่มส่งฟอร์ม (BR-LOOP-21)
    await expect(reset(page)).toHaveAttribute("type", "button")
  })

  test("AC-LOOP-09 บนจอ 375 จุด สองปุ่มยังอยู่บรรทัดเดียวกัน", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/backtest")

    const [resetBox, submitBox] = await Promise.all([
      reset(page).boundingBox(),
      submit(page).boundingBox(),
    ])
    expect(Math.abs(resetBox!.y - submitBox!.y)).toBeLessThan(4)
    expect(resetBox!.x).toBeLessThan(submitBox!.x)
  })

  test("AC-LOOP-10 + AC-LOOP-11 กดแล้วฟอร์มว่าง ผลหาย ลิงก์กลับเป็นหน้าเปล่า", async ({ page }) => {
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible()

    await reset(page).click()

    await expect(page).toHaveURL(/\/backtest$/)
    await expect(page.getByTestId("growth-chart")).toHaveCount(0)
    await expect(page.getByTestId("summary-rows")).toHaveCount(0)
    // เหลือพอร์ตเดียวที่ยังไม่ได้กรอก
    await expect(page.locator("#p0-symbol-0")).toHaveValue("")
    await expect(page.locator("#p1-symbol-0")).toHaveCount(0)
    await expect(page.locator("#amount")).toHaveValue("10000")
  })

  test("AC-LOOP-12 กดย้อนกลับแล้วได้ผลเดิมคืนมาครบ", async ({ page }) => {
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible()
    const before = await ready(page).textContent()

    await reset(page).click()
    await expect(page).toHaveURL(/\/backtest$/)

    await page.goBack()

    // นี่คือข้อพิสูจน์ว่าไม่ต้องมีกล่องยืนยัน — ปุ่มย้อนกลับคือปุ่มเลิกทำ (PD-022)
    await expect(ready(page)).toHaveText(before!)
    await expect(page.locator("#p0-name")).toHaveValue("ผสม")
    await expect(legendItems(page, "growth-legend")).toHaveCount(4)
  })

  test("AC-LOOP-13 ข้อความตรวจสอบที่ค้างอยู่ถูกล้างไปด้วย", async ({ page }) => {
    await page.goto("/backtest")
    await page.locator("#p0-symbol-0").fill("VTI")
    await page.keyboard.press("Escape")
    await page.locator("#p0-weight-0").fill("60")
    await submit(page).click()

    const message = page.getByText(/น้ำหนักรวมของพอร์ตต้องเท่ากับ 100%/)
    await expect(message).toBeVisible()

    await reset(page).click()

    await expect(message).toHaveCount(0)
    await expect(page.locator("#p0-symbol-0")).toHaveValue("")
  })

  test("AC-LOOP-14 อยู่ที่ลิงก์เปล่าแล้วกด ค่าที่กรอกค้างไว้ถูกล้าง", async ({ page }) => {
    await page.goto("/backtest")
    await page.locator("#p0-symbol-0").fill("VTI")
    await page.keyboard.press("Escape")
    await page.locator("#amount").fill("55555")

    await reset(page).click()

    await expect(page.locator("#p0-symbol-0")).toHaveValue("")
    await expect(page.locator("#amount")).toHaveValue("10000")
  })

  test("AC-LOOP-15 กด Enter ในช่องกรอกยังเริ่มทดสอบ ไม่ใช่ล้างค่า", async ({ page }) => {
    await page.goto("/backtest")
    await page.locator("#p0-symbol-0").fill("VTI")
    await page.keyboard.press("Escape")
    await page.locator("#p0-weight-0").fill("100")
    await page.locator("#p0-symbol-1").fill("")

    await page.locator("#amount").press("Enter")

    // ถ้าปุ่มคืนค่าแย่งเป็นปุ่มปริยายของฟอร์ม ช่องนี้จะถูกล้างแทนที่จะได้ผลลัพธ์
    await expect(soloReady(page)).toBeVisible()
    await expect(page.locator("#p0-symbol-0")).toHaveValue("VTI")
  })

  /**
   * AC-LOOP-16 — ชุดทดสอบใช้ข้อมูลจำลองที่อ่านในเบราว์เซอร์เอง **ไม่มีคำขอผ่านเครือข่ายให้หน่วง**
   * สถานะ "กำลังคำนวณ" จึงจบเร็วกว่าที่จะจับได้ · การไล่จับสภาวะชั่วคราวแบบนี้คือเทสต์ที่ล้ม
   * ไม่คงที่ (บทเรียน ep#11) จึงตรวจ**ผลลัพธ์**แทน: กดรัวแล้วต้องได้ผลชุดเดียวที่ถูกต้อง
   * ไม่ใช่ฟอร์มที่ถูกล้างกลางคัน
   *
   * ส่วนที่ว่าปุ่มกดไม่ได้จริงระหว่างคำนวณ พิสูจน์บน route จริงที่มีเครือข่ายหน่วงจริง
   */
  test("AC-LOOP-16 กดรัวระหว่างคำนวณแล้วไม่มีอะไรถูกล้างกลางคัน", async ({ page }) => {
    await page.goto("/backtest")
    await page.locator("#p0-symbol-0").fill("VTI")
    await page.keyboard.press("Escape")
    await page.locator("#p0-weight-0").fill("100")
    await page.locator("#p0-symbol-1").fill("")

    await submit(page).click()
    await submit(page).click()

    await expect(soloReady(page)).toBeVisible()
    await expect(page.locator("#p0-symbol-0")).toHaveValue("VTI")

    // เมื่อคำนวณจบ ทั้งสองปุ่มต้องกลับมากดได้ — กันปุ่มค้างอยู่ในสถานะกดไม่ได้
    await expect(reset(page)).toBeEnabled()
    await expect(submit(page)).toBeEnabled()
  })

  test("EC-LOOP-07 กดซ้ำจากลิงก์เปล่าไม่เพิ่มรายการย้อนกลับซ้อนกัน", async ({ page }) => {
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible()

    await reset(page).click()
    await expect(page).toHaveURL(/\/backtest$/)
    await reset(page).click()
    await expect(page).toHaveURL(/\/backtest$/)

    // ครั้งที่สองไม่สร้างรายการใหม่ ย้อนกลับครั้งเดียวจึงถึงผลเดิม
    await page.goBack()
    await expect(ready(page)).toBeVisible()
  })
})
