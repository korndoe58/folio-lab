/**
 * รอให้เครื่องให้บริการจริงขึ้นรุ่นใหม่ ก่อนจะไปอ่านค่าจากหน้าเว็บ (S13, ตามเกณฑ์ ratchet ของ PD-003)
 *
 * เหตุที่มี: ทั้ง S10 และ S11 เกิดเรื่องเดียวกัน — เปิด production ตรวจค่าเร็วเกินไป
 * เลยอ่านค่าจากรุ่น**ก่อน** deploy แล้วสรุปผิดว่าโค้ดยังพัง เสียเวลาไล่หาบั๊กที่แก้ไปแล้ว
 * การจับเวลาเอาเองไม่เคยพอ เพราะเวลา deploy ไม่คงที่ — ต้องดูจากตัวรุ่นจริง
 *
 * ใช้สองขั้น:
 *   node scripts/verify-production.mjs snapshot   # ก่อน push — จำรุ่นปัจจุบันไว้
 *   node scripts/verify-production.mjs wait       # หลัง push — รอจนรุ่นเปลี่ยน
 *
 * ตั้ง PROD_URL ได้ ถ้าไม่ตั้งจะใช้ที่อยู่ของโปรเจกต์นี้
 */
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const PROD_URL = process.env.PROD_URL ?? "https://folio-lab-gamma.vercel.app"
/** ดูทั้งสองหน้า เพราะการเปลี่ยนที่กระทบหน้าเดียวก็ต้องนับว่าเป็นรุ่นใหม่ */
const PROBE_PATHS = ["/", "/backtest"]
const STATE_FILE = path.join(process.cwd(), "node_modules/.cache/folio-lab/prod-build-id")
const POLL_SECONDS = 10
const TIMEOUT_SECONDS = 600

/**
 * ลายนิ้วมือของรุ่นที่ให้บริการอยู่ = **แฮชของ HTML ทั้งหน้า** ที่เสิร์ฟจริง
 *
 * เดิมใช้แค่รายชื่อไฟล์สคริปต์ที่หน้าอ้างถึง ซึ่ง**มองไม่เห็นการเปลี่ยนแปลงที่เกิดฝั่ง
 * เครื่องแม่ข่ายล้วน** — ข้อมูลพรีวิวของหน้าเว็บ สคริปต์ที่ฝังในหน้า และทุกอย่างที่
 * server component สร้าง ไม่ทำให้เกิดไฟล์สคริปต์ใหม่สักไฟล์ ชื่อไฟล์จึงเหมือนเดิมทั้งชุด
 *
 * S20b เจอของจริง: deploy งานที่อยู่ใน server component ล้วน แล้วสคริปต์นี้รายงานว่า
 * "รุ่นยังไม่เปลี่ยน" จนหมดเวลา 600 วินาที ทั้งที่รุ่นใหม่ขึ้นไปแล้ว (ep#57)
 *
 * ใช้ HTML ทั้งหน้าได้เพราะยืนยันแล้วว่า**คงที่ทุกไบต์ระหว่างคำขอ** (ยิงซ้ำสามครั้งได้ค่าเดียวกัน)
 * ถ้าวันหนึ่งหน้าเว็บมีค่าที่เปลี่ยนทุกคำขอ ลายนิ้วมือจะขยับเองตลอดและกลายเป็น**ผลบวกลวง**
 * ซึ่งอันตรายกว่าของเดิม — ตอนนั้นต้องตัดส่วนที่แปรผันออกก่อน ไม่ใช่กลับไปใช้ชื่อไฟล์
 */
async function fetchBuildId() {
  const parts = []

  for (const probePath of PROBE_PATHS) {
    const res = await fetch(`${PROD_URL}${probePath}`, { cache: "no-store" })
    if (!res.ok) throw new Error(`${probePath} ตอบ ${res.status}`)
    const html = await res.text()

    // กันการจำหน้าที่ผิดปกติ (หน้า error, หน้าเปล่า) มาเป็นลายนิ้วมือของรุ่นที่ใช้ได้
    if (!/\/_next\/static\/chunks\/[A-Za-z0-9._-]+\.js/.test(html)) {
      throw new Error(`${probePath} ไม่มีไฟล์สคริปต์ — อาจได้หน้าที่ผิดปกติมา`)
    }

    parts.push(html)
  }

  return createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 12)
}

async function snapshot() {
  const buildId = await fetchBuildId()
  await mkdir(path.dirname(STATE_FILE), { recursive: true })
  await writeFile(STATE_FILE, buildId, "utf8")
  console.log(`จำรุ่นปัจจุบันไว้แล้ว: ${buildId}`)
  console.log("push ได้เลย แล้วค่อยรัน: node scripts/verify-production.mjs wait")
}

async function wait() {
  let before
  try {
    before = (await readFile(STATE_FILE, "utf8")).trim()
  } catch {
    throw new Error("ยังไม่ได้จำรุ่นก่อนหน้า — รัน `node scripts/verify-production.mjs snapshot` ก่อน push")
  }

  const deadline = Date.now() + TIMEOUT_SECONDS * 1000
  console.log(`รุ่นก่อน push: ${before} — กำลังรอรุ่นใหม่ที่ ${PROD_URL}`)

  while (Date.now() < deadline) {
    let current
    try {
      current = await fetchBuildId()
    } catch (error) {
      // ระหว่างสลับรุ่นอาจตอบไม่ปกติชั่วคราว ถือเป็นเรื่องปกติแล้วลองใหม่
      console.log(`  ยังอ่านไม่ได้ (${error.message}) — ลองใหม่`)
      await sleep(POLL_SECONDS)
      continue
    }

    if (current !== before) {
      console.log(`รุ่นใหม่ขึ้นแล้ว: ${current} — ตรวจค่าบนหน้าเว็บได้`)
      return
    }
    console.log(`  ยังเป็นรุ่นเดิม (${current}) — รออีก ${POLL_SECONDS} วินาที`)
    await sleep(POLL_SECONDS)
  }

  throw new Error(
    [
      `รอครบ ${TIMEOUT_SECONDS} วินาทีแล้ว HTML ที่เสิร์ฟยังไม่เปลี่ยนสักไบต์`,
      "",
      "อ่านได้สองแบบ:",
      "  1. รอบนี้แก้แต่เอกสาร/สคริปต์/เทสต์ ซึ่งไม่กระทบสิ่งที่เบราว์เซอร์ได้รับ — ถือว่าปกติ ไม่มีอะไรให้รอ",
      "  2. deploy ล้มเหลวจริง หรือ push ไม่ขึ้น — เปิดหน้า deployment ดู",
      "",
      "แยกสองข้อนี้ด้วยการดูว่า commit รอบนี้แตะไฟล์ใน src/ หรือ public/ หรือเปล่า",
    ].join("\n"),
  )
}

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

const COMMANDS = { snapshot, wait }
const command = process.argv[2]

if (!COMMANDS[command]) {
  console.error(`ใช้: node scripts/verify-production.mjs <${Object.keys(COMMANDS).join("|")}>`)
  process.exit(2)
}

COMMANDS[command]().catch((error) => {
  console.error(`ล้มเหลว: ${error.message}`)
  process.exit(1)
})
