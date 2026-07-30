import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3100",
  },
  webServer: {
    // ชุดทดสอบใช้ข้อมูลจำลอง เพื่อให้ผลเหมือนเดิมทุกครั้งและไม่พึ่งเครือข่าย
    command: "NEXT_PUBLIC_DATA_MODE=stub npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
