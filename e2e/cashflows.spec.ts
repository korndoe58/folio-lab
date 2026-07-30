import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-18 (เงินเข้าออก) + US-19 (วิธีปรับสมดุล)
 *
 * เทสต์ที่สำคัญที่สุดของไฟล์นี้คือ AC-CMP-26 — พอร์ตที่ใส่เงินเพิ่มแบบกระจายตามสัดส่วนที่ถืออยู่
 * ต้องได้ผลตอบแทนต่อปีของพอร์ต **เท่ากับชุดที่ลงทีเดียวทุกหลัก** ถ้าค่านั้นขยับ แปลว่าลำดับ
 * ภายในเดือนของชั้นคำนวณสลับที่ ซึ่งทำให้ตัวเลขผิดแบบดูสมเหตุสมผล
 */
const EVIDENCE = "artifacts/evidence/S15b"
const SHARED = "start=2015&end=2025&amount=10000&benchmark=SPY&base=USD"

const submit = (page: Page) => page.getByRole("button", { name: "เริ่มทดสอบ", exact: true })
const cell = (page: Page, index: number, metric: string) =>
  page.getByTestId(`portfolio${index}-${metric}`)
const soloCell = (page: Page, metric: string) => page.getByTestId(`portfolio-${metric}`)
const cashflowToggle = (page: Page) =>
  page.getByRole("checkbox", { name: "ใส่เงินเพิ่มหรือถอนเงินระหว่างทาง" })

const text = async (locator: ReturnType<typeof soloCell>) => (await locator.innerText()).trim()

test.describe("US-19 เลือกวิธีปรับสมดุล", () => {
  test("AC-CMP-33 ฟอร์มเปล่าตั้งไว้ที่รายปี พร้อมหมายเหตุเรื่องค่าธรรมเนียม", async ({ page }) => {
    await page.goto("/backtest")

    await expect(page.locator("#p0-rebalance")).toHaveValue("annual")
    await expect(page.getByText("ไม่คิดค่าธรรมเนียมและภาษี").first()).toBeVisible()
    // ช่องเกณฑ์ยังไม่โผล่จนกว่าจะเลือกแบบเบี่ยงเบน
    await expect(page.locator("#p0-band")).toHaveCount(0)
  })

  test("AC-CMP-43 ลิงก์ที่ไม่ระบุวิธีปรับสมดุล ได้ค่าเดิมทุกหลัก", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:60,BND:40&${SHARED}`)

    await expect(soloCell(page, "endBalance")).toBeVisible()
    await expect(page.locator("#p0-rebalance")).toHaveValue("annual")
    // ไม่มีพอร์ตไหนตั้งค่าแปลกไปจากปริยาย แถวจำนวนครั้งจึงไม่โผล่ (BR-CMP-46)
    await expect(soloCell(page, "rebalanceCount")).toHaveCount(0)
  })

  test("AC-CMP-35 ไม่ปรับกับปรับรายปีได้ค่าต่างกัน และนับครั้งถูก", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:60,BND:40&p1.rb=none&p2=VTI:60,BND:40&${SHARED}`)

    await expect(cell(page, 0, "endBalance")).toBeVisible()
    expect(await text(cell(page, 0, "endBalance"))).not.toBe(
      await text(cell(page, 1, "endBalance")),
    )

    // แถวจำนวนครั้งโผล่เพราะมีพอร์ตที่ตั้งไม่ตรงค่าปริยาย (BR-CMP-63)
    await expect(cell(page, 0, "rebalanceCount")).toHaveText("0")
    expect(Number(await text(cell(page, 1, "rebalanceCount")))).toBeGreaterThan(0)
  })

  test("AC-CMP-38 แบบเบี่ยงเบนปรับน้อยครั้งกว่ารายเดือนบนพอร์ตเดียวกัน", async ({ page }) => {
    await page.goto(
      `/backtest?p1=VTI:60,BND:40&p1.rb=bands:5&p2=VTI:60,BND:40&p2.rb=monthly&${SHARED}`,
    )

    await expect(cell(page, 0, "rebalanceCount")).toBeVisible()
    const bands = Number(await text(cell(page, 0, "rebalanceCount")))
    const monthly = Number(await text(cell(page, 1, "rebalanceCount")))
    expect(bands).toBeLessThan(monthly)
  })

  test("AC-CMP-39 เกณฑ์นอกช่วงถูกกั้นไว้ ไม่มีผลลัพธ์ออกมา", async ({ page }) => {
    await page.goto("/backtest")

    await page.locator("#p0-symbol-0").fill("VTI")
    await page.keyboard.press("Escape")
    await page.locator("#p0-weight-0").fill("100")
    await page.locator("#p0-rebalance").selectOption("bands")
    // เปลี่ยนมาแบบเบี่ยงเบนแล้วช่องเกณฑ์โผล่พร้อมค่าปริยาย 5 (BR-CMP-57)
    await expect(page.locator("#p0-band")).toHaveValue("5")

    await page.locator("#p0-band").fill("80")
    await submit(page).click()

    await expect(
      page.getByText("เกณฑ์การเบี่ยงเบนต้องอยู่ระหว่าง 1 ถึง 50 จุดเปอร์เซ็นต์"),
    ).toBeVisible()
    await expect(soloCell(page, "endBalance")).toHaveCount(0)
  })

  test("AC-CMP-40 พอร์ตสินทรัพย์เดียวได้ค่าเท่ากันทุกวิธี", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:100&p1.rb=none&p2=VTI:100&p3=VTI:100&p3.rb=monthly&${SHARED}`)

    await expect(cell(page, 0, "endBalance")).toBeVisible()
    const values = await Promise.all([0, 1, 2].map((i) => text(cell(page, i, "endBalance"))))
    expect(new Set(values).size).toBe(1)
  })

  test("AC-CMP-41 จำนวนครั้งนับเฉพาะการปรับตามรอบ ไม่นับการใส่เงิน", async ({ page }) => {
    await page.goto(
      `/backtest?p1=VTI:60,BND:40&p1.rb=none&p1.cf=200:m:in:fixed:target:flat&${SHARED}`,
    )

    // ตั้งไม่ปรับ แล้วใส่เงินทุกเดือนแบบตามน้ำหนักเป้าหมาย — ยังต้องนับได้ 0 (BR-CMP-59)
    await expect(soloCell(page, "rebalanceCount")).toHaveText("0")
  })

  test("AC-CMP-42 ลิงก์เก็บวิธีปรับสมดุลและเกณฑ์ แล้วเปิดใหม่ได้ค่าเดิม", async ({ page }) => {
    const link = `/backtest?p1=VTI:60,BND:40&p1.rb=bands:8&p2=VTI:60,BND:40&p2.rb=quarterly&${SHARED}`
    await page.goto(link)
    await expect(cell(page, 0, "endBalance")).toBeVisible()
    const before = await text(cell(page, 0, "endBalance"))

    await page.goto(link)
    await expect(page.locator("#p0-rebalance")).toHaveValue("bands")
    await expect(page.locator("#p0-band")).toHaveValue("8")
    await expect(page.locator("#p1-rebalance")).toHaveValue("quarterly")
    expect(await text(cell(page, 0, "endBalance"))).toBe(before)
  })
})

test.describe("US-18 ใส่เงินเพิ่มหรือถอนเงินระหว่างทาง", () => {
  test("AC-CMP-21 ตัวเลือกเงินเข้าออกปิดอยู่ และไม่มีช่องอื่นโผล่มารบกวน", async ({ page }) => {
    await page.goto("/backtest")

    await expect(cashflowToggle(page)).not.toBeChecked()
    await expect(page.locator("#p0-cashflow-amount")).toHaveCount(0)

    await cashflowToggle(page).click()
    await expect(page.locator("#p0-cashflow-direction")).toHaveValue("deposit")
    await expect(page.locator("#p0-cashflow-frequency")).toHaveValue("monthly")
    await expect(page.locator("#p0-cashflow-allocation")).toHaveValue("prorata")
    await expect(page.locator("#p0-cashflow-amount")).toHaveValue("")
  })

  test("AC-CMP-22 ยอดรวมที่จะใส่และจำนวนงวดแสดงก่อนกดรัน", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:60,BND:40&${SHARED}`)

    await cashflowToggle(page).click()
    await page.locator("#p0-cashflow-amount").fill("200")

    // 2015–2025 = 132 เดือน ใส่ทุกเดือน = 132 งวด × $200
    await expect(page.locator("#p0-cashflow-total")).toHaveText(
      "จะใส่ทั้งหมดประมาณ $26,400 ใน 132 งวด",
    )

    await page.locator("#p0-cashflow-frequency").selectOption("annual")
    await expect(page.locator("#p0-cashflow-total")).toHaveText(
      "จะใส่ทั้งหมดประมาณ $2,200 ใน 11 งวด",
    )
  })

  test("AC-CMP-25 พอร์ตที่ไม่มีเงินเข้าออกไม่มีสองแถวใหม่เลย", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:60,BND:40&${SHARED}`)

    await expect(soloCell(page, "endBalance")).toBeVisible()
    await expect(soloCell(page, "totalContributed")).toHaveCount(0)
    await expect(soloCell(page, "moneyWeightedReturn")).toHaveCount(0)
  })

  test("AC-CMP-26 ใส่เงินแบบกระจายตามสัดส่วนที่ถืออยู่ ผลตอบแทนของพอร์ตไม่ขยับ", async ({
    page,
  }) => {
    await page.goto(
      `/backtest?p1=VTI:60,BND:40&p2=VTI:60,BND:40&p2.cf=200:m:in:fixed:prorata:flat&${SHARED}`,
    )

    await expect(cell(page, 0, "cagr")).toBeVisible()
    // ★ ค่าเหล่านี้ต้องตรงทุกหลัก — เงินที่ใส่ไม่ควรแตะชุดผลตอบแทนเลย (BR-CMP-40)
    for (const metric of ["cagr", "stdev", "maxDrawdown", "sharpe", "sortino", "bestYear"]) {
      expect(await text(cell(page, 1, metric)), `แถว ${metric}`).toBe(
        await text(cell(page, 0, metric)),
      )
    }

    // แต่มูลค่าสุดท้ายและผลตอบแทนของเงินคุณต่างกัน เพราะใส่เงินเข้าไปจริง
    expect(await text(cell(page, 1, "endBalance"))).not.toBe(await text(cell(page, 0, "endBalance")))
    expect(await text(cell(page, 1, "moneyWeightedReturn"))).not.toBe(
      await text(cell(page, 1, "cagr")),
    )
  })

  test("AC-CMP-45 กระจายตามน้ำหนักเป้าหมายทำให้ผลตอบแทนต่างออกไป พร้อมคำอธิบายบนจอ", async ({
    page,
  }) => {
    // ตั้งไม่ปรับสมดุลตามรอบทั้งคู่ วิธีกระจายเงินจึงเป็นตัวเดียวที่ต่างกัน
    await page.goto(
      `/backtest?p1=VTI:60,BND:40&p1.rb=none&p2=VTI:60,BND:40&p2.rb=none&p2.cf=200:m:in:fixed:target:flat&${SHARED}`,
    )

    await expect(cell(page, 0, "cagr")).toBeVisible()
    expect(await text(cell(page, 1, "cagr"))).not.toBe(await text(cell(page, 0, "cagr")))
    await expect(page.getByText("เทียบกับพอร์ตอื่นไม่ได้ตรง ๆ")).toBeVisible()
  })

  test("AC-CMP-23 สองนิยามผลตอบแทนโผล่คู่กันพร้อมคำอธิบายความต่าง", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:60,BND:40&p1.cf=200:m:in:fixed:prorata:flat&${SHARED}`)

    await expect(soloCell(page, "cagr")).toBeVisible()
    await expect(soloCell(page, "moneyWeightedReturn")).toBeVisible()
    await expect(page.getByText("นับจังหวะที่ใส่และถอนด้วย")).toBeVisible()

    // เงินที่ใส่ทั้งหมด = เงินตั้งต้น $10,000 + 132 งวด × $200
    await expect(soloCell(page, "totalContributed")).toHaveText("$36,400")
  })

  test("AC-CMP-24 พอร์ตที่ไม่มีเงินเข้าออกแสดงขีดในแถวของเงินเข้าออก", async ({ page }) => {
    await page.goto(
      `/backtest?p1=VTI:60,BND:40&p2=VTI:60,BND:40&p2.cf=200:m:in:fixed:prorata:flat&${SHARED}`,
    )

    await expect(cell(page, 0, "totalContributed")).toHaveText("—")
    await expect(cell(page, 0, "moneyWeightedReturn")).toHaveText("—")
    await expect(cell(page, 1, "totalContributed")).not.toHaveText("—")
  })

  test("AC-CMP-27 ถอนจนพอร์ตหมด แจ้ง N-004 พร้อมเดือนที่หมด", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:100&p1.cf=900:m:out:fixed:prorata:flat&${SHARED}`)

    await expect(page.getByText(/พอร์ตนี้ถูกถอนจนหมดเมื่อ .+ ค่าหลังจากนั้นจึงเป็นศูนย์/)).toBeVisible()
    await expect(soloCell(page, "endBalance")).toHaveText("$0")
    // ค่าอื่นยังคำนวณและแสดงตามปกติ
    await expect(soloCell(page, "cagr")).not.toHaveText("—")
  })

  test("AC-CMP-29 จำนวนต่องวดที่ไม่ใช่ตัวเลขบวก ถูกกั้นไว้", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:100&${SHARED}`)

    await cashflowToggle(page).click()
    await page.locator("#p0-cashflow-amount").fill("0")
    await submit(page).click()

    await expect(page.getByText("จำนวนที่ใส่หรือถอนต่องวดต้องเป็นตัวเลขที่มากกว่า 0")).toBeVisible()
  })

  test("AC-CMP-30 อัตราถอนแบบเปอร์เซ็นต์นอกช่วง ถูกกั้นไว้", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:100&${SHARED}`)

    await cashflowToggle(page).click()
    await page.locator("#p0-cashflow-direction").selectOption("withdraw")
    await page.locator("#p0-cashflow-basis").selectOption("percent")
    await page.locator("#p0-cashflow-amount").fill("120")
    await submit(page).click()

    await expect(page.getByText("อัตราถอนต่องวดต้องอยู่ระหว่าง 0 ถึง 100 เปอร์เซ็นต์")).toBeVisible()
    await expect(soloCell(page, "endBalance")).toHaveCount(0)
  })

  test("AC-CMP-31 เส้นเงินที่ใส่สะสมและคอลัมน์ในตารางประกอบ", async ({ page }) => {
    await page.goto(
      `/backtest?p1=VTI:60,BND:40&p2=VTI:60,BND:40&p2.cf=200:m:in:fixed:prorata:flat&${SHARED}`,
    )

    await expect(page.getByTestId("growth-chart")).toBeVisible()
    // ตารางประกอบมีคอลัมน์ของพอร์ตที่มีเงินเข้าออกเท่านั้น ไม่ใช่ทุกพอร์ต
    await page.getByText("ดูเป็นตาราง").click()
    await expect(
      page.getByRole("columnheader", { name: "เงินที่ใส่สะสมของพอร์ต 2" }),
    ).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "เงินที่ใส่สะสมของพอร์ต 1" })).toHaveCount(0)

    // สิ้นปี 2015 ใส่มาแล้ว 12 งวด × $200 บวกเงินตั้งต้น $10,000
    await expect(page.getByTestId("contributed1-2015")).toHaveText("$12,400")
  })

  test("AC-CMP-32 ลิงก์เก็บเงินเข้าออกครบทุกค่า แล้วเปิดใหม่ได้ค่าเดิม", async ({ page }) => {
    const link = `/backtest?p1=VTI:60,BND:40&p1.cf=300:q:in:fixed:target:cpi&${SHARED}`
    await page.goto(link)
    await expect(soloCell(page, "endBalance")).toBeVisible()
    const before = await text(soloCell(page, "endBalance"))

    await page.goto(link)
    await expect(page.locator("#p0-cashflow-amount")).toHaveValue("300")
    await expect(page.locator("#p0-cashflow-frequency")).toHaveValue("quarterly")
    await expect(page.locator("#p0-cashflow-direction")).toHaveValue("deposit")
    await expect(page.locator("#p0-cashflow-allocation")).toHaveValue("target")
    await expect(
      page.getByRole("checkbox", { name: "เพิ่มจำนวนตามเงินเฟ้อไทยทุกปี" }),
    ).toBeChecked()
    expect(await text(soloCell(page, "endBalance"))).toBe(before)
  })

  test("EC-CMP-17 เปิดตัวเลือกแล้วปิดกลับ ได้ค่าเดิมทุกหลัก", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:60,BND:40&${SHARED}`)
    await expect(soloCell(page, "endBalance")).toBeVisible()
    const before = {
      endBalance: await text(soloCell(page, "endBalance")),
      cagr: await text(soloCell(page, "cagr")),
      stdev: await text(soloCell(page, "stdev")),
    }

    await cashflowToggle(page).click()
    await page.locator("#p0-cashflow-amount").fill("200")
    await submit(page).click()
    await expect(soloCell(page, "totalContributed")).toBeVisible()

    await cashflowToggle(page).click()
    await submit(page).click()
    // สองแถวใหม่หายไป และค่าที่เหลือกลับมาเท่าเดิมทุกหลัก
    await expect(soloCell(page, "totalContributed")).toHaveCount(0)
    expect(await text(soloCell(page, "endBalance"))).toBe(before.endBalance)
    expect(await text(soloCell(page, "cagr"))).toBe(before.cagr)
    expect(await text(soloCell(page, "stdev"))).toBe(before.stdev)
  })

  test("EC-CMP-12 ช่วงสั้นกว่าหนึ่งงวด ไม่มีงวดเกิดขึ้นเลย", async ({ page }) => {
    await page.goto("/backtest?assets=VTI:100&start=2020&end=2020&amount=10000&benchmark=SPY&base=USD")

    await cashflowToggle(page).click()
    await page.locator("#p0-cashflow-amount").fill("200")
    await page.locator("#p0-cashflow-frequency").selectOption("annual")
    // ปีเดียว = 12 เดือน จึงมีงวดเดียวพอดี ส่วนช่วงที่สั้นกว่านั้นไม่มีงวดเลย
    await expect(page.locator("#p0-cashflow-total")).toHaveText("จะใส่ทั้งหมดประมาณ $200 ใน 1 งวด")
  })
})

test.describe("จอแคบและสองธีม", () => {
  const LINK = `/backtest?p1=VTI:60,BND:40&p1.rb=bands:8&p2=VTI:60,BND:40&p2.cf=200:m:in:fixed:prorata:flat&${SHARED}`

  test("จอ 375 จุด อ่านได้ครบไม่ล้นแนวนอน", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto(LINK)

    await expect(cell(page, 0, "endBalance")).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `${EVIDENCE}/cashflows-mobile.png`, fullPage: true })
  })

  test("ธีมสว่างและธีมมืด", async ({ page }) => {
    await page.goto(LINK)
    await expect(cell(page, 0, "endBalance")).toBeVisible()
    await page.screenshot({ path: `${EVIDENCE}/cashflows-light.png`, fullPage: true })

    await page.emulateMedia({ colorScheme: "dark" })
    await page.reload()
    await expect(cell(page, 0, "endBalance")).toBeVisible()
    await page.screenshot({ path: `${EVIDENCE}/cashflows-dark.png`, fullPage: true })
  })
})
