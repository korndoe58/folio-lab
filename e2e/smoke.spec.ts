import { expect, test } from "@playwright/test"

test("landing page renders app name and disclaimer", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "folio-lab" })).toBeVisible()
  await expect(page.getByText("ผลตอบแทนในอดีตไม่ได้รับประกันผลตอบแทนในอนาคต")).toBeVisible()
  await page.screenshot({ path: "artifacts/evidence/S0/landing-light.png", fullPage: true })
})

test("landing page in dark mode", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("html")).not.toHaveClass(/dark/) // ค่าเริ่มต้นคือโหมดสว่าง
  await expect(async () => {
    await page.getByRole("button", { name: "สลับโหมดสว่างและมืด" }).click()
    await expect(page.locator("html")).toHaveClass(/dark/, { timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
  await expect(page.getByRole("heading", { name: "folio-lab" })).toBeVisible()
  await page.screenshot({ path: "artifacts/evidence/S0/landing-dark.png", fullPage: true })
})

test("แชร์ลิงก์แล้วได้การ์ดพรีวิวครบ และไม่มีคำอ้างกองทุนไทย (US-36)", async ({ page }) => {
  await page.goto("/")

  const content = async (selector: string) =>
    await page.locator(selector).first().getAttribute("content")

  // AC-SOC-01 — ข้อมูลพรีวิวครบสี่อย่าง
  expect(await content('meta[property="og:title"]')).toContain("folio-lab")
  expect(await content('meta[property="og:site_name"]')).toBe("folio-lab")
  expect(await content('meta[property="og:description"]')).toBeTruthy()

  // BR-SOC-03 — ที่อยู่ภาพต้องเป็น URL เต็ม ไม่ใช่ path สัมพัทธ์
  const image = await content('meta[property="og:image"]')
  expect(image).toMatch(/^https:\/\/.+\/og\.png$/)

  // BR-SOC-07 — การ์ดแบบภาพใหญ่
  expect(await content('meta[name="twitter:card"]')).toBe("summary_large_image")

  // AC-SOC-05 — คำอธิบายพรีวิวต้องไม่อ้างกองทุนไทย ตราบใดที่ PD-012 ยังพักอยู่
  expect(await content('meta[property="og:description"]')).not.toContain("กองทุนไทย")

  // AC-SOC-02 — ไฟล์ภาพมีอยู่จริง
  const res = await page.request.get("/og.png")
  expect(res.status()).toBe(200)
})

test("ประโยคแนะนำบอกเฉพาะสิ่งที่ทำได้จริง ทั้งสองภาษา (US-36)", async ({ page }) => {
  await page.goto("/")

  // AC-SOC-03 — ภาษาไทย
  await expect(page.getByText("ทั้งหุ้นไทยและ ETF ต่างประเทศ", { exact: false })).toBeVisible()
  await expect(page.getByText("กองทุนรวมไทยยังไม่เปิดใช้", { exact: false })).toBeVisible()
  // BR-DMO-06 (US-11) ยังต้องเป็นจริง — ห้ามมีคำว่ากำลังพัฒนาลอย ๆ บนหน้าแรก
  await expect(page.getByText("กำลังพัฒนา")).toHaveCount(0)

  // AC-SOC-04 — ภาษาอังกฤษ
  await expect(async () => {
    await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()
    await expect(
      page.getByText("Thai stocks and global ETFs", { exact: false }),
    ).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
  await expect(page.getByText("Thai mutual funds are not available yet", { exact: false })).toBeVisible()
})

test("language toggle switches copy without losing the page", async ({ page }) => {
  await page.goto("/")
  // click may land before hydration finishes on a cold dev server, so retry until it takes effect
  await expect(async () => {
    await page.getByRole("button", { name: "เปลี่ยนภาษา" }).click()
    await expect(
      page.getByText("Past performance does not guarantee future returns", { exact: false }),
    ).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
  await page.getByRole("button", { name: "Switch language" }).click()
  await expect(page.getByText("ผลตอบแทนในอดีตไม่ได้รับประกันผลตอบแทนในอนาคต")).toBeVisible()
})
