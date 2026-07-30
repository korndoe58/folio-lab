import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-16 + US-17 — เทียบหลายพอร์ตบนหน้าจอจริง
 *
 * เทสต์ที่สำคัญที่สุดในไฟล์นี้คือ "พอร์ตเดียวได้ค่าเดิมทุกหลัก" เพราะการขยายให้รองรับหลายพอร์ต
 * แตะทุกจอที่สร้างมาตั้งแต่ S5 — ถ้าทำของเดิมพังจะเสียความน่าเชื่อถือของสิ่งที่ ship ไปแล้ว
 */
const EVIDENCE = "artifacts/evidence/S15"
const SHARED = "start=2015&end=2025&amount=10000&benchmark=SPY&base=USD"
const TWO = `p1=VTI:60,BND:40&p1.n=ผสม&p2=VTI:100&p2.n=หุ้นล้วน&${SHARED}`
const THREE = `${TWO}&p3=PTT.BK:100`
/** ลิงก์รูปแบบเดียวกับที่บันทึกไว้ในหลักฐานของ S8 */
const LEGACY = "/backtest?assets=VTI:60,BND:40&start=2015&end=2025&amount=10000&benchmark=SPY"
/** พอร์ตอ้างอิงของ golden fixture */
const REFERENCE =
  "/backtest?assets=VTI:48,VNQ:8,VXUS:24,BND:20&start=2012&end=2026&amount=10000&benchmark=SPY&base=USD"

const ready = (page: Page) => page.getByTestId("portfolio0-endBalance")
const soloReady = (page: Page) => page.getByTestId("portfolio-endBalance")
const submit = (page: Page) => page.getByRole("button", { name: "เริ่มทดสอบ", exact: true })
const addPortfolio = (page: Page) => page.getByRole("button", { name: "เพิ่มพอร์ตเทียบ" })

/** กรอกช่องที่มีรายการแนะนำแล้วปิดรายการ เหมือนที่ผู้ใช้ทำก่อนไปทำอย่างอื่นต่อ */
async function fillSymbol(page: Page, id: string, value: string) {
  await page.locator(id).fill(value)
  await page.keyboard.press("Escape")
}

test.describe("US-16 ตั้งค่าและเทียบพอร์ตได้ถึง 3 ชุด", () => {
  test("AC-CMP-01 ฟอร์มเปล่ามีพอร์ตเดียว และค่าที่ใช้ร่วมกันมีที่กรอกที่เดียว", async ({ page }) => {
    await page.goto("/backtest")

    await expect(page.locator("#p0-symbol-0")).toBeVisible()
    await expect(page.locator("#p1-symbol-0")).toHaveCount(0)
    await expect(addPortfolio(page)).toBeEnabled()

    // ค่าที่เป็นฐานของการเทียบมีช่องเดียว ไม่ซ้ำต่อพอร์ต (PD-014)
    for (const id of ["#amount", "#baseCurrency", "#benchmark", "#startYear", "#endYear"]) {
      await expect(page.locator(id)).toHaveCount(1)
    }
    // พอร์ตเดียวยังไม่มีช่องชื่อ จอของการใช้งานปกติจึงเหมือนเดิม (BR-CMP-31)
    await expect(page.locator("#p0-name")).toHaveCount(0)
  })

  test("AC-CMP-02 เพิ่มได้ถึง 3 พอร์ต แล้วปุ่มเพิ่มใช้ไม่ได้พร้อมบอกเหตุผล", async ({ page }) => {
    await page.goto("/backtest")

    await addPortfolio(page).click()
    await addPortfolio(page).click()

    await expect(page.locator("#p2-symbol-0")).toBeVisible()
    await expect(page.locator("#p0-name")).toHaveValue("")
    await expect(page.locator("#p0-name")).toHaveAttribute("placeholder", "พอร์ต 1")
    await expect(page.locator("#p2-name")).toHaveAttribute("placeholder", "พอร์ต 3")

    await expect(addPortfolio(page)).toBeDisabled()
    await expect(addPortfolio(page)).toHaveAttribute("title", "เทียบได้สูงสุด 3 พอร์ต")
  })

  test("AC-CMP-03 ลบพอร์ตได้จนเหลือชุดเดียว แล้วปุ่มลบใช้ไม่ได้", async ({ page }) => {
    await page.goto("/backtest")
    await addPortfolio(page).click()

    await page.getByRole("button", { name: "ลบพอร์ต 2" }).click()
    await expect(page.locator("#p1-symbol-0")).toHaveCount(0)
    // เหลือพอร์ตเดียวแล้วกลับไปหน้าตาเดิม ไม่มีช่องชื่อและไม่มีปุ่มลบพอร์ต
    await expect(page.locator("#p0-name")).toHaveCount(0)
  })

  test("AC-CMP-04 ตารางสรุปมีคอลัมน์ต่อพอร์ตและคอลัมน์ตัวเทียบ", async ({ page }) => {
    await page.goto(`/backtest?${TWO}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    const header = page.locator("thead tr").first()
    await expect(header.locator("th")).toHaveCount(4)
    await expect(header).toContainText("ผสม")
    await expect(header).toContainText("หุ้นล้วน")
    await expect(header).toContainText("ตลาด (SPY)")

    await expect(page.getByTestId("summary-rows").locator("tr")).toHaveCount(9)
    for (const metric of ["endBalance", "cagr", "sharpe"]) {
      await expect(page.getByTestId(`portfolio0-${metric}`)).not.toBeEmpty()
      await expect(page.getByTestId(`portfolio1-${metric}`)).not.toBeEmpty()
      await expect(page.getByTestId(`benchmark-${metric}`)).not.toBeEmpty()
    }
  })

  test("AC-CMP-05 เปลี่ยนชื่อพอร์ตแล้วหัวคอลัมน์และลิงก์เปลี่ยนตาม", async ({ page }) => {
    await page.goto(`/backtest?${TWO}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await page.locator("#p1-name").fill("หุ้นล้วนจริง ๆ")
    await submit(page).click()

    await expect(page.locator("thead tr").first()).toContainText("หุ้นล้วนจริง ๆ", {
      timeout: 30_000,
    })
    await expect(page).toHaveURL(/p2\.n=/)
  })

  test("AC-CMP-06 ข้อความน้ำหนักรวมชี้ไปที่พอร์ตที่ผิดจริง", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:100&p2=VTI:60,BND:30&${SHARED}`)
    await submit(page).click()

    await expect(
      page.getByText("น้ำหนักรวมของพอร์ตต้องเท่ากับ 100% ตอนนี้รวมได้ 90%"),
    ).toHaveCount(1)
    await expect(ready(page)).toHaveCount(0)
  })

  test("AC-CMP-07 ชื่อพอร์ตซ้ำแจ้ง V-013 และยังไม่คำนวณ", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:100&p1.n=ทดลอง&p2=BND:100&p2.n=ทดลอง&${SHARED}`)
    await submit(page).click()

    await expect(
      page.getByText("ชื่อพอร์ตซ้ำกัน ตั้งชื่อให้ต่างกันเพื่อให้อ่านผลง่ายขึ้น"),
    ).toHaveCount(2)
    await expect(ready(page)).toHaveCount(0)
  })

  test("AC-CMP-08 ลิงก์ของ 3 พอร์ตพร้อมชื่อภาษาไทย เปิดซ้ำได้ค่าเดิม", async ({ page }) => {
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    const before = await Promise.all(
      [0, 1, 2].map((i) => page.getByTestId(`portfolio${i}-cagr`).textContent()),
    )

    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    const after = await Promise.all(
      [0, 1, 2].map((i) => page.getByTestId(`portfolio${i}-cagr`).textContent()),
    )

    expect(after).toEqual(before)
    await expect(page.locator("#p0-name")).toHaveValue("ผสม")
    await expect(page.locator("#p2-name")).toHaveValue("")
  })

  test("AC-CMP-09 ลิงก์รูปแบบเดิมให้ค่าเดิมทุกหลัก", async ({ page }) => {
    await page.goto(LEGACY)
    await expect(soloReady(page)).toBeVisible({ timeout: 30_000 })

    await expect(page.getByTestId("portfolio-cagr")).toHaveText("8.64%")
    await expect(soloReady(page)).toHaveText("$24,884")
    // หัวคอลัมน์ยังเป็นคำเดิม ไม่มีเลขลำดับมารบกวน (BR-CMP-31)
    await expect(page.locator("thead tr").first()).toContainText("พอร์ตของคุณ")
  })

  test("AC-CMP-10 ข้อมูลเริ่มช้ากว่า แจ้งช่วงถูกย่อครั้งเดียว", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:100&p2=NEWFUND:100&start=2015&end=2025&amount=10000&benchmark=SPY&base=USD`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(page.getByText("ช่วงเวลาถูกปรับเป็น", { exact: false })).toHaveCount(1)
  })

  test("AC-CMP-11 สัญลักษณ์เดียวกันข้ามพอร์ตใช้ได้ ไม่มีข้อความว่าซ้ำ", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:100&p2=VTI:60,BND:40&${SHARED}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(page.getByText("สัญลักษณ์นี้มีอยู่ในพอร์ตแล้ว")).toHaveCount(0)
    await expect(page.getByTestId("portfolio1-cagr")).not.toBeEmpty()
  })

  test("EC-CMP-02 ลิงก์ที่มีพอร์ตเกิน 3 ชุด แจ้ง V-008 แล้วเติมสามชุดแรกให้แก้ต่อ", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:100&p2=BND:100&p3=SPY:100&p4=VNQ:100&${SHARED}`)

    await expect(page.getByText("ลิงก์นี้มีค่าตั้งต้นไม่ครบหรือไม่ถูกต้อง")).toBeVisible()
    await expect(page.locator("#p2-symbol-0")).toHaveValue("SPY")
    await expect(page.locator("#p3-symbol-0")).toHaveCount(0)
  })

  test("กรอกพอร์ตที่สองเองแล้วรันได้", async ({ page }) => {
    await page.goto("/backtest")
    await fillSymbol(page, "#p0-symbol-0", "VTI")
    await page.locator("#p0-weight-0").fill("100")

    await addPortfolio(page).click()
    await fillSymbol(page, "#p1-symbol-0", "BND")
    await page.locator("#p1-weight-0").fill("100")

    await submit(page).click()
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await expect(page).toHaveURL(/p1=VTI:100/)
    await expect(page).toHaveURL(/p2=BND:100/)
  })
})

test.describe("US-17 กราฟและตารางทุกส่วนแสดงหลายพอร์ตพร้อมกัน", () => {
  test("AC-CMP-12/13 กราฟมูลค่ามีเส้นครบและตารางสิ้นปีมีคอลัมน์ครบ", async ({ page }) => {
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    // 3 พอร์ต + ตัวเทียบ
    await expect(page.getByTestId("growth-chart").locator(".recharts-line")).toHaveCount(4)

    await page.locator("summary").first().click()
    const header = page.getByTestId("growth-year-end").locator("..").locator("thead tr")
    await expect(header).toContainText("ผสม")
    await expect(header).toContainText("หุ้นล้วน")
    await expect(header).toContainText("พอร์ต 3")
    await expect(page.getByTestId("year-end0-2025")).not.toBeEmpty()
    await expect(page.getByTestId("year-end2-2025")).not.toBeEmpty()
  })

  test("BR-CMP-28 เส้นของแต่ละพอร์ตแยกกันได้โดยไม่พึ่งสี", async ({ page }) => {
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    const dashes = await page
      .getByTestId("growth-chart")
      .locator(".recharts-line-curve")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("stroke-dasharray") ?? "solid"))

    expect(new Set(dashes).size, `ลายเส้นต้องต่างกันทุกเส้น ได้ ${dashes.join(" / ")}`).toBe(
      dashes.length,
    )
  })

  test("AC-CMP-14 กราฟและตารางรายปีมีค่าครบทุกพอร์ต", async ({ page }) => {
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(page.getByTestId("annual-chart").locator(".recharts-bar")).toHaveCount(4)
    for (const i of [0, 1, 2]) {
      await expect(page.getByTestId(`annual${i}-2019`)).not.toBeEmpty()
    }
  })

  test("AC-CMP-15 ช่วงขาดทุนแยกตารางต่อพอร์ต และตรงกับตารางสรุป", async ({ page }) => {
    await page.goto(`/backtest?${TWO}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(page.getByRole("heading", { name: "ช่วงขาดทุนของผสม" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "ช่วงขาดทุนของหุ้นล้วน" })).toBeVisible()

    for (const i of [0, 1]) {
      const summaryDepth = ((await page.getByTestId(`portfolio${i}-maxDrawdown`).textContent()) ?? "")
        .trim()
        .split("\n")[0]
      await expect(page.getByTestId(`drawdown${i}-depth-1`)).toHaveText(summaryDepth)
    }
  })

  test("AC-CMP-16 ข้อความแปลงค่าเงินขึ้นครั้งเดียว ไม่ใช่ครั้งต่อพอร์ต", async ({ page }) => {
    await page.goto(`/backtest?p1=PTT.BK:100&p2=VTI:100&start=2015&end=2025&amount=350000&benchmark=SPY&base=THB`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await expect(page.getByText("แปลงค่าเงิน", { exact: false })).toHaveCount(1)
    await expect(page.getByTestId("portfolio0-endBalance")).toContainText("฿")
    await expect(page.getByTestId("portfolio1-endBalance")).toContainText("฿")
  })

  test("AC-CMP-17 คำกำกับหักเงินเฟ้อขึ้นครบทุกพอร์ต ค่าความเสี่ยงไม่ถูกกำกับ", async ({ page }) => {
    await page.goto(`/backtest?${TWO}&real=1`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    for (const metric of ["endBalance", "cagr", "bestYear", "worstYear"]) {
      await expect(page.getByTestId(`adjusted-${metric}`)).toBeVisible()
    }
    for (const metric of ["stdev", "maxDrawdown", "sharpe", "sortino"]) {
      await expect(page.getByTestId(`adjusted-${metric}`)).toHaveCount(0)
    }
    // ข้อความที่กราฟและ N-003 ขึ้นครั้งเดียวสำหรับทั้งการเทียบ
    await expect(page.getByText("เส้นนี้ยังเป็นมูลค่าตามตัวเงิน", { exact: false })).toHaveCount(1)
  })

  test("AC-CMP-18 เทียบพอร์ตเดียว ทุกส่วนได้ค่าเดิมทุกหลัก", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(soloReady(page)).toBeVisible({ timeout: 30_000 })

    await expect(page.getByTestId("portfolio-cagr")).toHaveText("10.31%")
    await expect(page.getByTestId("portfolio-maxDrawdown")).toContainText("-23.55%")
    await expect(page.getByTestId("portfolio-sharpe")).toHaveText("0.78")

    // testid เดิมของทุกส่วนยังอยู่ครบ หลักฐานเก่าจึงอ่านได้เหมือนเดิม
    await expect(page.getByTestId("drawdown-table")).toBeVisible()
    await expect(page.getByTestId("annual-2019")).toBeVisible()
    await expect(page.getByTestId("growth-chart").locator(".recharts-line")).toHaveCount(2)
    // ไม่มีหัวข้อช่วงขาดทุนรายพอร์ตมารบกวนตอนเทียบพอร์ตเดียว
    await expect(page.getByRole("heading", { name: /ช่วงขาดทุนของ/ })).toHaveCount(0)
  })
})

test.describe("เทียบหลายพอร์ตในสภาพแวดล้อมจริง", () => {
  test("AC-CMP-19/20 จอแคบ สองธีม และเดินด้วยแป้นพิมพ์", async ({ page, browser }) => {
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })
    await page.screenshot({ path: `${EVIDENCE}/three-portfolios-light.png`, fullPage: true })

    await page.getByRole("button", { name: "สลับโหมดสว่างและมืด" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.screenshot({ path: `${EVIDENCE}/three-portfolios-dark.png`, fullPage: true })

    // ชื่อพอร์ตเข้าถึงด้วยแป้นพิมพ์ได้ และปุ่มลบบอกชื่อพอร์ตที่จะลบ
    await page.locator("#p1-name").focus()
    await expect(page.locator("#p1-name")).toBeFocused()
    await expect(page.getByRole("button", { name: "ลบหุ้นล้วน" })).toBeVisible()

    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const mobilePage = await mobile.newPage()
    await mobilePage.goto(`/backtest?${THREE}`)
    await expect(mobilePage.getByTestId("portfolio0-endBalance")).toBeVisible({ timeout: 30_000 })

    const overflow = await mobilePage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, "หน้าเว็บต้องไม่เลื่อนแนวนอนบนจอแคบ").toBeLessThanOrEqual(0)
    await mobilePage.screenshot({ path: `${EVIDENCE}/three-portfolios-mobile.png`, fullPage: true })
    await mobile.close()
  })

  test("สลับภาษาแล้วชื่อปริยายเปลี่ยน แต่ชื่อที่ตั้งเองคงเดิม", async ({ page }) => {
    await page.goto(`/backtest?${THREE}`)
    await expect(ready(page)).toBeVisible({ timeout: 30_000 })

    await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()
    const header = page.locator("thead tr").first()
    await expect(header).toContainText("ผสม")
    await expect(header).toContainText("Portfolio 3")
  })
})
