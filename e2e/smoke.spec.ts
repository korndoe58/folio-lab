import { expect, test } from "@playwright/test"

test("landing page renders app name and disclaimer", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "folio-lab" })).toBeVisible()
  await expect(page.getByText("ผลตอบแทนในอดีตไม่ได้รับประกันผลตอบแทนในอนาคต")).toBeVisible()
  await page.screenshot({ path: "artifacts/evidence/S0/landing-light.png", fullPage: true })
})

test("landing page in dark mode", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" })
  const page = await context.newPage()
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "folio-lab" })).toBeVisible()
  await page.screenshot({ path: "artifacts/evidence/S0/landing-dark.png", fullPage: true })
  await context.close()
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
