import { readFileSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"

/**
 * R10 walk ของ US-20 (หน้าต่างเลื่อน) · US-21 (ตารางรายเดือน + ส่งออกไฟล์) · US-22 (คัดลอกลิงก์)
 *
 * เทสต์ที่สำคัญที่สุดสองข้อของไฟล์นี้:
 * · **คำนวณผลคูณต่อเนื่องจากไฟล์ที่บันทึกจริง แล้วต้องได้มูลค่าสุดท้ายตรงกับที่หน้าจอแสดง** —
 *   ถ้าเผลอปัดเศษก่อนเขียนไฟล์ ข้อนี้จะจับได้ทันที
 * · **ลิงก์ที่ยาวที่สุดที่เฟส 2 สร้างได้ เปิดกลับแล้วได้ค่าเดิมทุกหลัก** — ตัววัดข้อ 3 ของ epic
 */
const EVIDENCE = "artifacts/evidence/S16"
const SHARED = "start=2015&end=2025&amount=10000&benchmark=SPY&base=USD"
/** พอร์ตอ้างอิงของ golden fixture — 174 เดือน จึงมีค่าครบทั้งสี่หน้าต่าง */
const REFERENCE = "/backtest?assets=VTI:48,VNQ:8,VXUS:24,BND:20&start=2012&end=2026&amount=10000&benchmark=SPY&base=USD"
/** ลิงก์ที่ยาวที่สุดเท่าที่เฟส 2 สร้างได้ — 3 พอร์ต · ชื่อไทย · เกณฑ์เบี่ยงเบน · เงินเข้าออก */
const LONGEST =
  "/backtest?p1=VTI:60,BND:40&p1.n=ผสม&p1.rb=bands:8" +
  "&p2=VTI:100&p2.n=หุ้นล้วน&p2.cf=200:m:in:fixed:prorata:flat" +
  `&p3=VTI:34,BND:33,VNQ:33&p3.n=กระจายสาม&p3.rb=quarterly&${SHARED}`

const cell = (page: Page, testid: string) => page.getByTestId(testid)
const text = async (page: Page, testid: string) => (await cell(page, testid).innerText()).trim()
/** ตารางรายเดือนพับไว้เป็นค่าเริ่มต้น ต้องกางก่อนถึงจะอ่านได้ (BR-CMP-73) */
const expandMonthly = (page: Page) => page.getByText("ผลตอบแทนรายเดือน", { exact: true }).click()

test.describe("US-20 ผลตอบแทนแบบหน้าต่างเลื่อน", () => {
  test("AC-CMP-65 มีครบสี่หน้าต่าง แต่ละหน้าต่างมีค่าครบสี่ค่า", async ({ page }) => {
    await page.goto(REFERENCE)
    await cell(page, "rolling-table").waitFor()

    for (const window of [12, 36, 60, 120]) {
      for (const part of ["low", "average", "high", "positive"]) {
        await expect(cell(page, `rolling-${part}-${window}`), `${part} ของ ${window} เดือน`).not.toHaveText("—")
      }
    }
  })

  test("AC-CMP-68 หน้าต่างที่ยาวกว่าช่วงข้อมูล เป็นขีดพร้อม N-005 ไม่ใช่ซ่อนแถวทิ้ง", async ({ page }) => {
    // 2020–2024 = 60 เดือน จึงสั้นกว่าหน้าต่าง 10 ปี
    await page.goto(`/backtest?assets=VTI:100&start=2020&end=2024&amount=10000&benchmark=SPY&base=USD`)
    await cell(page, "rolling-table").waitFor()

    // แถวยังอยู่ ค่าเป็นขีด
    await expect(cell(page, "rolling-low-120")).toHaveText("—")
    await expect(cell(page, "rolling-average-120")).toHaveText("—")
    await expect(cell(page, "rolling-positive-120")).toHaveText("—")
    await expect(cell(page, "rolling-unavailable-120")).toHaveText(
      "ช่วงเวลาที่เลือกสั้นกว่าหน้าต่าง 10 ปี จึงยังไม่มีค่าให้แสดง",
    )
    // หน้าต่างที่สั้นกว่ายังมีค่าตามปกติ (สำเร็จบางส่วน ไม่ใช่ล้มทั้งส่วน)
    await expect(cell(page, "rolling-low-12")).not.toHaveText("—")
  })

  test("AC-CMP-69 เทียบสองพอร์ต มีค่าครบทุกหน้าต่างทั้งสองพอร์ต", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:60,BND:40&p1.n=ผสม&p2=VTI:100&p2.n=หุ้นล้วน&${SHARED}`)
    await cell(page, "rolling-table").waitFor()

    for (const window of [12, 36, 60]) {
      await expect(cell(page, `rolling0-average-${window}`)).not.toHaveText("—")
      await expect(cell(page, `rolling1-average-${window}`)).not.toHaveText("—")
    }
    // ชื่อพอร์ตกำกับอยู่ในตาราง จึงรู้ว่าค่าไหนของใคร
    await expect(cell(page, "rolling-table").getByText("ผสม").first()).toBeVisible()
    await expect(cell(page, "rolling-table").getByText("หุ้นล้วน").first()).toBeVisible()
  })

  test("AC-CMP-70 ค่าไม่เปลี่ยนเมื่อเปิดเงินเข้าออกและปรับเงินเฟ้อ พร้อมข้อความกำกับ", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:60,BND:40&${SHARED}`)
    await cell(page, "rolling-table").waitFor()
    const plain = await Promise.all(
      [12, 36, 60].map((w) => text(page, `rolling-average-${w}`)),
    )

    // พอร์ตเดียวกัน แต่ใส่เงินเพิ่มทุกเดือนและเปิดหักเงินเฟ้อ
    await page.goto(`/backtest?p1=VTI:60,BND:40&p1.cf=200:m:in:fixed:prorata:flat&${SHARED}&real=1`)
    await cell(page, "rolling-table").waitFor()
    const withCashflow = await Promise.all(
      [12, 36, 60].map((w) => text(page, `rolling-average-${w}`)),
    )

    expect(withCashflow).toEqual(plain)
    await expect(
      page.getByText("ส่วนนี้คิดจากผลตอบแทนของพอร์ตล้วน ๆ ไม่รวมเงินเข้าออกและไม่หักเงินเฟ้อ"),
    ).toBeVisible()
  })

  test("BR-CMP-68 จอบอกว่าค่าเฉลี่ยไม่ใช่ผลตอบแทนทบต้นของทั้งช่วง", async ({ page }) => {
    await page.goto(REFERENCE)
    await cell(page, "rolling-table").waitFor()

    await expect(page.getByText("ไม่ใช่ผลตอบแทนทบต้นของทั้งช่วง")).toBeVisible()
    // และค่าจริงก็ต่างกันด้วย ไม่ใช่เตือนลอย ๆ
    expect(await text(page, "rolling-average-12")).not.toBe(await text(page, "portfolio-cagr"))
  })

  test("AC-CMP-71 ตารางอ่านทีละเซลล์แล้วรู้ว่าเป็นของหน้าต่างไหนและพอร์ตไหน", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:60,BND:40&p1.n=ผสม&p2=VTI:100&p2.n=หุ้นล้วน&${SHARED}`)
    await cell(page, "rolling-table").waitFor()

    // ระยะถือเป็นหัวของกลุ่มแถว · ชื่อพอร์ตเป็นหัวของแถว
    await expect(page.locator('th[scope="rowgroup"]').first()).toContainText("1 ปี")
    await expect(page.locator('#summary-heading')).toBeVisible()
    const rowHeaders = await cell(page, "rolling-table").locator('th[scope="row"]').count()
    expect(rowHeaders).toBe(4 * 2)
  })
})

test.describe("US-21 ตารางรายเดือนและส่งออกไฟล์", () => {
  test("AC-CMP-51 ส่วนนี้พับอยู่พร้อมบอกจำนวนเดือน กางแล้วมีคอลัมน์ครบ", async ({ page }) => {
    await page.goto(`/backtest?p1=VTI:60,BND:40&p1.n=ผสม&p2=VTI:100&p2.n=หุ้นล้วน&${SHARED}`)
    await cell(page, "monthly-save").waitFor()

    await expect(page.getByRole("heading", { name: "ผลตอบแทนรายเดือน (132 เดือน)" })).toBeVisible()
    await expect(cell(page, "monthly-table")).toBeHidden()

    await expandMonthly(page)
    await expect(cell(page, "monthly-table")).toBeVisible()
    await expect(cell(page, "monthly0-2015-01")).toBeVisible()
    await expect(cell(page, "monthly1-2015-01")).toBeVisible()
  })

  test("AC-CMP-52 จำนวนแถวเท่ากับจำนวนเดือนที่ตารางสรุปรายงาน", async ({ page }) => {
    await page.goto(REFERENCE)
    await cell(page, "monthly-save").waitFor()
    await expandMonthly(page)

    await expect(cell(page, "monthly-table").locator("tr")).toHaveCount(174)
    await expect(page.getByRole("heading", { name: "ผลตอบแทนรายเดือน (174 เดือน)" })).toBeVisible()
  })

  test("AC-CMP-53 ค่าของเดือนแรกแสดงเป็นเปอร์เซ็นต์ทศนิยมสองตำแหน่ง", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:60,BND:40&${SHARED}`)
    await cell(page, "monthly-save").waitFor()
    await expandMonthly(page)

    await expect(cell(page, "monthly-2015-01")).toHaveText(/^-?\d+\.\d{2}%$/)
  })

  test("AC-CMP-54 · AC-CMP-55 · AC-CMP-57 ไฟล์ที่บันทึกถูกต้องและคำนวณกลับได้ตรง", async ({ page }) => {
    await page.goto(
      `/backtest?p1=VTI:60,BND:40&p1.n=ผสม&p2=VTI:100&p2.n=หุ้น, พันธบัตร&${SHARED}`,
    )
    await cell(page, "monthly-save").waitFor()

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      cell(page, "monthly-save").click(),
    ])
    const csv = readFileSync((await download.path())!, "utf8")
    const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n")

    // ชื่อไฟล์บอกได้ว่าเป็นผลของอะไร พร้อมช่วงเวลา
    expect(download.suggestedFilename()).toBe("ผลตอบแทนรายเดือน-2015-01-2025-12.csv")
    // เปิดในโปรแกรมตารางคำนวณแล้วภาษาไทยอ่านออก
    expect(csv.startsWith("﻿")).toBe(true)
    expect(lines[0]).toContain("ดอลลาร์สหรัฐ")
    expect(lines[0]).toContain("ไม่หักเงินเฟ้อ")
    // ชื่อที่มีตัวคั่นอยู่ในชื่อ ถูกครอบให้อยู่คอลัมน์เดียว (AC-CMP-57)
    expect(lines[2]).toBe('เดือน,ผสม,"หุ้น, พันธบัตร",SPY')

    // ★ ค่าดิบไม่ปัด — คำนวณกลับแล้วต้องตรงกับที่หน้าจอแสดง (AC-CMP-55)
    const data = lines.slice(3)
    expect(data).toHaveLength(132)
    const fromFile = data.reduce((value, line) => value * (1 + Number(line.split(",")[1])), 10_000)
    const onScreen = await text(page, "portfolio0-endBalance")
    expect(`$${Math.round(fromFile).toLocaleString("en-US")}`).toBe(onScreen)
  })

  test("AC-CMP-56 บรรทัดหัวเรื่องบอกสถานะปรับเงินเฟ้อ และค่ารายเดือนไม่เปลี่ยน", async ({ page }) => {
    await page.goto(`/backtest?assets=VTI:60,BND:40&${SHARED}`)
    await cell(page, "monthly-save").waitFor()
    await expandMonthly(page)
    const plain = await text(page, "monthly-2015-01")

    await page.goto(`/backtest?p1=VTI:60,BND:40&p1.cf=200:m:in:fixed:prorata:flat&${SHARED}&real=1`)
    await cell(page, "monthly-save").waitFor()
    await expandMonthly(page)
    // ชุดของพอร์ตล้วน ๆ จึงไม่ขยับ (BR-CMP-81)
    expect(await text(page, "monthly-2015-01")).toBe(plain)

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      cell(page, "monthly-save").click(),
    ])
    const csv = readFileSync((await download.path())!, "utf8")
    expect(csv).toContain("หักเงินเฟ้อแล้ว")
    expect(csv).toContain("ไม่รวมเงินเข้าออกและไม่หักเงินเฟ้อ")
  })

  test("AC-CMP-58 จอ 375 จุด ตารางเลื่อนในกรอบตัวเอง หน้าเว็บไม่เลื่อนแนวนอน", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    await page.goto(REFERENCE)
    await cell(page, "monthly-save").waitFor()
    await expandMonthly(page)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: `${EVIDENCE}/s16-mobile.png`, fullPage: true })
  })
})

test.describe("US-22 คัดลอกลิงก์", () => {
  test("AC-CMP-59 ยังไม่เคยรัน ไม่มีปุ่มคัดลอกลิงก์", async ({ page }) => {
    await page.goto("/backtest")
    await expect(cell(page, "copy-link")).toHaveCount(0)
  })

  test("AC-CMP-60 · AC-CMP-63 กดแล้วเห็นการตอบกลับ และกดด้วยแป้นพิมพ์ได้", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto(`/backtest?assets=VTI:60,BND:40&${SHARED}`)
    await cell(page, "copy-link").waitFor()

    await expect(cell(page, "copy-link")).toHaveText("คัดลอกลิงก์")
    await cell(page, "copy-link").focus()
    await page.keyboard.press("Enter")

    await expect(cell(page, "copy-link")).toHaveText("คัดลอกแล้ว")
    // ประกาศให้โปรแกรมอ่านหน้าจอรู้ ไม่ใช่แค่เปลี่ยนหน้าตาปุ่ม
    await expect(page.getByRole("status").filter({ hasText: "คัดลอกแล้ว" })).toHaveCount(1)
    // แล้วหายไปเองโดยไม่ต้องกดปิด
    await expect(cell(page, "copy-link")).toHaveText("คัดลอกลิงก์", { timeout: 5000 })
  })

  test("AC-CMP-61 · AC-CMP-64 ลิงก์ยาวที่สุดของเฟส 2 เปิดกลับได้ครบทุกค่า", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto(LONGEST)
    await cell(page, "portfolio0-endBalance").waitFor()

    const before: Record<string, string> = {}
    for (const metric of ["endBalance", "cagr", "stdev", "maxDrawdown", "rebalanceCount"]) {
      before[metric] = await text(page, `portfolio0-${metric}`)
    }

    await cell(page, "copy-link").click()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    // ตัวคั่นระหว่างสัญลักษณ์กับน้ำหนักยังอ่านออก ไม่ถูกเข้ารหัสจนอ่านไม่ได้ (BR-CMP-87)
    expect(copied).toContain("VTI:60,BND:40")

    // เปิดในบริบทใหม่แล้วต้องได้ผลชุดเดียวกันโดยไม่ต้องกดอะไร
    const fresh = await context.newPage()
    await fresh.goto(copied)
    await fresh.getByTestId("portfolio0-endBalance").waitFor()

    for (const metric of ["endBalance", "cagr", "stdev", "maxDrawdown", "rebalanceCount"]) {
      expect(await text(fresh, `portfolio0-${metric}`), `แถว ${metric}`).toBe(before[metric])
    }
    // ค่าที่ตั้งไว้ทุกตัวกลับมาครบ — ชื่อไทย เกณฑ์เบี่ยงเบน และเงินเข้าออก (EC-CMP-35)
    await expect(fresh.locator("#p0-name")).toHaveValue("ผสม")
    await expect(fresh.locator("#p2-name")).toHaveValue("กระจายสาม")
    await expect(fresh.locator("#p0-band")).toHaveValue("8")
    await expect(fresh.locator("#p1-cashflow-amount")).toHaveValue("200")
    await expect(fresh.locator("#p2-rebalance")).toHaveValue("quarterly")
    await fresh.close()
  })

  test("AC-CMP-62 คัดลอกไม่สำเร็จ ต้องมีลิงก์ให้คัดลอกเอง ไม่ล้มเหลวเงียบ", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("denied")) },
      })
    })
    await page.goto(`/backtest?assets=VTI:60,BND:40&${SHARED}`)
    await cell(page, "copy-link").waitFor()
    await cell(page, "copy-link").click()

    await expect(cell(page, "copy-link-manual")).toBeVisible()
    await expect(page.locator("#copy-link-box")).toHaveValue(/\/backtest\?assets=VTI:60,BND:40/)
    await expect(page.getByText("เลือกข้อความทั้งหมดแล้วคัดลอกได้เลย")).toBeVisible()
  })

  test("EC-CMP-33 กดซ้ำติด ๆ กัน การตอบกลับไม่ซ้อนกัน", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto(`/backtest?assets=VTI:60,BND:40&${SHARED}`)
    await cell(page, "copy-link").waitFor()

    await cell(page, "copy-link").click()
    await cell(page, "copy-link").click()
    await cell(page, "copy-link").click()

    await expect(page.getByRole("status").filter({ hasText: "คัดลอกแล้ว" })).toHaveCount(1)
  })

  test("EC-CMP-34 แก้ฟอร์มค้างไว้แล้วกดคัดลอก ได้ลิงก์ของผลที่แสดงอยู่", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await page.goto(`/backtest?assets=VTI:60,BND:40&${SHARED}`)
    await cell(page, "copy-link").waitFor()

    // แก้น้ำหนักแต่ยังไม่กดรัน
    await page.locator("#p0-weight-0").fill("80")
    await cell(page, "copy-link").click()

    const copied = await page.evaluate(() => navigator.clipboard.readText())
    // ได้ของผลที่แสดงอยู่ ไม่ใช่ของค่าที่กำลังแก้
    expect(copied).toContain("VTI:60,BND:40")
    expect(copied).not.toContain("VTI:80")
  })
})

test.describe("สองธีมของส่วนใหม่", () => {
  test("ธีมสว่างและธีมมืด", async ({ page }) => {
    await page.goto(LONGEST)
    await page.getByTestId("rolling-table").waitFor()
    await page.getByTestId("rolling-table").scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${EVIDENCE}/s16-light.png`, fullPage: true })

    await page.emulateMedia({ colorScheme: "dark" })
    await page.reload()
    await page.getByTestId("rolling-table").waitFor()
    await page.screenshot({ path: `${EVIDENCE}/s16-dark.png`, fullPage: true })
  })
})
