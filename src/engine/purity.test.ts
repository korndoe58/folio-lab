import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "vitest"

/**
 * ความบริสุทธิ์ของชั้นคำนวณ (BR-ENG-13, BR-FND-04)
 *
 * ยกระดับจาก "ตรวจด้วยตา" เป็นเทสต์ถาวร — ถ้าใครเผลอเรียกภายนอกหรืออ่านนาฬิกา
 * ในชั้นคำนวณ ชุดทดสอบจะจับได้ทันที
 */
const ENGINE_DIR = path.join(process.cwd(), "src/engine")

const FORBIDDEN: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bfetch\s*\(/, reason: "ติดต่อภายนอก" },
  { pattern: /\bnew Date\b|\bDate\.now\b/, reason: "อ่านเวลาปัจจุบัน" },
  { pattern: /\bMath\.random\b/, reason: "สุ่มค่า" },
  { pattern: /\bprocess\.(env|cwd)\b/, reason: "อ่านสภาพแวดล้อมของเครื่อง" },
  { pattern: /from ["']@\/data\//, reason: "ดึงข้อมูลเอง (ต้องรับผ่านพารามิเตอร์)" },
  { pattern: /from ["']node:/, reason: "ใช้ความสามารถของระบบไฟล์หรือระบบปฏิบัติการ" },
]

test("ไฟล์ในชั้นคำนวณต้องไม่ติดต่อภายนอก ไม่อ่านนาฬิกา และไม่สุ่มค่า", async () => {
  const entries = await readdir(ENGINE_DIR)
  const sourceFiles = entries.filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))

  expect(sourceFiles.length, "ต้องมีไฟล์ในชั้นคำนวณให้ตรวจ").toBeGreaterThan(0)

  const violations: string[] = []
  for (const file of sourceFiles) {
    const code = await readFile(path.join(ENGINE_DIR, file), "utf8")
    for (const { pattern, reason } of FORBIDDEN) {
      if (pattern.test(code)) violations.push(`${file}: ${reason}`)
    }
  }

  expect(violations, `พบการละเมิดความบริสุทธิ์: ${violations.join(" · ")}`).toEqual([])
})
