#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

/**
 * guard: ตัวค้นที่ผ่านเพราะ**บังเอิญไม่ซ้ำ** (ep#10, ep#31)
 *
 * ปัญหาที่กันไว้: `page.locator("summary")` แมตช์ตัวเดียวจริง ๆ ตอนที่หน้าจอยังเล็ก
 * เทสต์จึงเขียวและดูปลอดภัย · พอหน้าจอโตขึ้นอีกส่วนหนึ่งที่มีแท็กเดียวกัน มันจะจับติดไปด้วย
 * แล้วเทสต์แดงโดยที่ **ของไม่ได้พัง** — หรือแย่กว่านั้นคือไปตรวจของผิดชิ้นเงียบ ๆ
 *
 * **strict mode ของ Playwright จับข้อนี้ไม่ได้** เพราะตอนเขียนมันแมตช์ตัวเดียวจริง
 * ต่างจากกรณีข้อความซ้ำ (ep#38, ep#45) ที่ strict mode ฟ้องให้เองทันที
 * guard นี้จึงจับเฉพาะช่องว่างที่เครื่องมืออื่นไม่ได้ปิด
 *
 * เกิดมาแล้วสี่ครั้ง (ep#10, ep#31, ep#38, ep#45) จึงเกินเกณฑ์ ratchet ของ PD-003 ไปมาก
 */

const E2E_DIR = path.join(process.cwd(), "e2e")

/** แท็กที่ไม่ซ้ำโดยนิยามของเอกสาร HTML — ผูกกับ page ตรง ๆ ได้ */
const UNIQUE_BY_DEFINITION = new Set(["html", "body"])

/** `page.locator("...")` ที่ตัวเลือกเป็นแท็กหรือโครงสร้างล้วน ไม่มี id/class/attribute */
const BARE_LOCATOR = /page\s*\.locator\(\s*"([a-zA-Z][a-zA-Z0-9\s>]*)"\s*\)/g

async function main() {
  const entries = await readdir(E2E_DIR)
  const specs = entries.filter((file) => file.endsWith(".ts"))

  const problems = []
  for (const file of specs) {
    const source = await readFile(path.join(E2E_DIR, file), "utf8")
    const lines = source.split("\n")

    lines.forEach((line, index) => {
      for (const match of line.matchAll(BARE_LOCATOR)) {
        const selector = match[1].trim()
        if (UNIQUE_BY_DEFINITION.has(selector)) continue
        // ต่อ .filter(...) ให้แคบลงแล้ว ถือว่าเจาะจงพอ
        if (line.includes(".filter(")) continue
        problems.push({ file, line: index + 1, selector, text: line.trim() })
      }
    })
  }

  if (problems.length === 0) {
    console.log(`ตรวจ ${specs.length} ไฟล์ — ไม่พบตัวค้นที่ผูกกับแท็กล้วน`)
    return
  }

  console.error(`พบตัวค้นที่ผูกกับแท็กล้วน ${problems.length} จุด — เสี่ยงจับติดของอื่นเมื่อหน้าจอโต\n`)
  for (const item of problems) {
    console.error(`  ${item.file}:${item.line}  page.locator("${item.selector}")`)
    console.error(`    ${item.text}`)
  }
  console.error(
    [
      "",
      "วิธีแก้: ผูกกับ data-testid ของส่วนที่ตั้งใจ หรือ scope ให้แคบลงก่อน เช่น",
      '  page.getByTestId("growth-chart").locator("summary")',
      '  page.locator("table").filter({ has: page.getByTestId("summary-rows") })',
      "",
      "เหตุผล: ตัวค้นแบบนี้ผ่านเพราะบังเอิญมีตัวเดียว ไม่ใช่เพราะเจาะจงถูก (ep#10, ep#31)",
    ].join("\n"),
  )
  process.exitCode = 1
}

await main()
