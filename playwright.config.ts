import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3100",
  },
  /**
   * ตัวตรวจรอได้นานกว่าค่าปริยาย 5 วินาที
   *
   * ข้อที่รอ**ผลการคำนวณรอบที่สอง** (สลับตัวเลือกแล้วกดรันใหม่) ใช้เวลาเกิน 5 วินาทีได้
   * เมื่อรันทั้งชุดพร้อมกัน — ชุดโตจาก 48 เป็น 218 ข้อตั้งแต่ S8 และหน้าผลลัพธ์คำนวณ
   * มากขึ้นทุกเฟส · เกิดมาแล้วสามครั้ง (EC-CMP-17, AC-INF-10) จึงแก้ที่ค่าปริยาย
   * แทนการไล่เพิ่มทีละข้อ
   */
  expect: { timeout: 15_000 },
  webServer: {
    // ชุดทดสอบใช้ข้อมูลจำลอง เพื่อให้ผลเหมือนเดิมทุกครั้งและไม่พึ่งเครือข่าย
    command: "NEXT_PUBLIC_DATA_MODE=stub npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
