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
const PROBE_PATH = "/backtest"
const STATE_FILE = path.join(process.cwd(), "node_modules/.cache/folio-lab/prod-build-id")
const POLL_SECONDS = 10
const TIMEOUT_SECONDS = 600

/**
 * ลายนิ้วมือของรุ่นที่ให้บริการอยู่ = รายชื่อไฟล์สคริปต์ที่หน้าเว็บอ้างถึง
 * ชื่อไฟล์เหล่านี้มีค่าแฮชของเนื้อหาอยู่ในตัว จึงเปลี่ยนทุกครั้งที่ build ใหม่
 */
async function fetchBuildId() {
  const res = await fetch(`${PROD_URL}${PROBE_PATH}`, { cache: "no-store" })
  if (!res.ok) throw new Error(`${PROBE_PATH} ตอบ ${res.status}`)
  const html = await res.text()

  const chunks = [...new Set(html.match(/\/_next\/static\/chunks\/[A-Za-z0-9._-]+\.js/g) ?? [])].sort()
  if (chunks.length === 0) throw new Error("หาไฟล์สคริปต์ในหน้าเว็บไม่เจอ — รูปแบบหน้าอาจเปลี่ยนไป")

  return createHash("sha256").update(chunks.join("\n")).digest("hex").slice(0, 12)
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
    `รอครบ ${TIMEOUT_SECONDS} วินาทีแล้วรุ่นยังไม่เปลี่ยน — ตรวจว่า deploy ล้มเหลวหรือ push ไม่ขึ้นหรือเปล่า`,
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
