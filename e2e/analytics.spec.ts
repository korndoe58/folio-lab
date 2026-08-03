import { expect, test, type Page, type Request } from "@playwright/test"

/**
 * R10 walk ของ US-37 — วัดผลการใช้งาน
 *
 * ชุดนี้รันบนโหมดข้อมูลจำลอง ซึ่งเป็นสภาพที่ **BR-USE-04 สั่งให้ปิดการส่งทั้งหมด** ·
 * จึงยืนยันปลายทางจริงไม่ได้ และไม่ควรพยายาม — สิ่งที่ยืนยันได้และมีค่าที่สุดคือ
 * **ชุดทดสอบสองร้อยกว่าข้อไม่ส่งข้อมูลปนเข้าไปในสถิติเลย** (AC-USE-04)
 *
 * ปลายทางจริงตรวจบนรุ่นที่ build แล้วพร้อมรหัสจริง ตามแผนตรวจสอบของการ์ด
 */
const SHARED = "start=2012&end=2026&amount=10000&benchmark=SPY&base=USD"
const REFERENCE = `/backtest?assets=VTI:48,VNQ:8,VXUS:24,BND:20&${SHARED}`

/** โดเมนของบริการวัดผลและตัวโหลดสคริปต์ของมัน */
const ANALYTICS_HOSTS = /google-analytics\.com|googletagmanager\.com|analytics\.google\.com/

/** จดทุกคำขอที่ออกไปหาบริการวัดผล ตั้งแต่ก่อนเปิดหน้าแรก */
function watchAnalytics(page: Page): Request[] {
  const seen: Request[] = []
  page.on("request", (request) => {
    if (ANALYTICS_HOSTS.test(request.url())) seen.push(request)
  })
  return seen
}

test.describe("US-37 วัดผลการใช้งาน", () => {
  test("★ AC-USE-04 ชุดทดสอบไม่ส่งอะไรออกไปหาบริการวัดผลเลย", async ({ page }) => {
    const seen = watchAnalytics(page)

    await page.goto(REFERENCE)
    await expect(page.getByTestId("portfolio-endBalance")).toBeVisible({ timeout: 30_000 })

    // กดทุกปุ่มที่มีเหตุการณ์ผูกอยู่ — ถ้าด่านไหนรั่ว จุดนี้จะจับได้
    await page.getByTestId("copy-link").click()
    await page.getByTestId("monthly-save").click()
    await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()

    expect(
      seen.map((r) => r.url()),
      "โหมดข้อมูลจำลองต้องไม่มีคำขอออกไปหาบริการวัดผลแม้แต่ครั้งเดียว",
    ).toEqual([])
  })

  test("AC-USE-05 ไม่มีสคริปต์ของบริการวัดผลอยู่ในหน้าเลย", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(page.getByTestId("portfolio-endBalance")).toBeVisible({ timeout: 30_000 })

    // ปิดแล้วต้องไม่วาดแท็กสคริปต์ออกมาตั้งแต่แรก ไม่ใช่วาดแล้วไม่ยิง
    const scripts = await page.evaluate((pattern: string) =>
      Array.from(document.querySelectorAll("script"))
        .map((s) => s.src || s.id)
        .filter((value) => new RegExp(pattern).test(value)),
    "googletagmanager|analytics-init")
    expect(scripts).toEqual([])
  })

  test("AC-USE-05 หน้าเว็บทำงานครบและไม่มี error ใน console เมื่อปิดอยู่", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })

    await page.goto(REFERENCE)
    await expect(page.getByTestId("portfolio-endBalance")).toBeVisible({ timeout: 30_000 })
    await page.getByTestId("copy-link").click()

    // การเรียกตัวห่อตอนปิดอยู่ต้องเงียบสนิท (BR-USE-19)
    expect(errors).toEqual([])
  })

  test("ปุ่มเดิมทุกปุ่มยังทำงานเหมือนเดิมหลังต่อสายเหตุการณ์", async ({ page }) => {
    await page.goto(REFERENCE)
    await expect(page.getByTestId("portfolio-endBalance")).toBeVisible({ timeout: 30_000 })

    await page.getByTestId("copy-link").click()
    // ปุ่มคัดลอกยังให้ผลตอบกลับเหมือนเดิม
    await expect(page.getByTestId("copy-link")).toBeVisible()

    await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()
    await expect(page.getByText(/How much can you take out/)).toBeVisible()
  })
})
