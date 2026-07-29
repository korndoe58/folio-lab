import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { compareMonths, type MonthlyReturn } from "@/types/series"
import { isEntryUsable, isFreshMonth, type CachedEntry, type ReturnsCache } from "./types"

const DEFAULT_DIR = path.join(process.cwd(), ".cache", "prices")
const FILE_VERSION = 1

type CacheFile = {
  version: number
  symbol: string
  months: Record<string, CachedEntry>
}

/**
 * คลังบนดิสก์สำหรับเครื่องพัฒนา — หนึ่งไฟล์ต่อหนึ่งสัญลักษณ์
 *
 * ที่เก็บอยู่หลังสัญญาเดียวกับคลังในหน่วยความจำ (BR-CCH-04) การสลับไปใช้ที่เก็บภายนอก
 * ตอนขึ้นเครื่องให้บริการจริงจึงไม่กระทบผู้เรียกเลย
 * ความล้มเหลวของคลังต้องไม่ทำให้คำขอล้ม (BR-CCH-07) — ทุก error ถูกกลืนที่ชั้นนี้
 */
export function createFsCache(options: { dir?: string; now?: () => Date } = {}): ReturnsCache {
  const dir = options.dir ?? DEFAULT_DIR
  const now = options.now ?? (() => new Date())

  const fileFor = (symbol: string) => path.join(dir, `${symbol.toLowerCase()}.json`)

  async function read(symbol: string): Promise<CacheFile | null> {
    try {
      const raw = await readFile(fileFor(symbol), "utf8")
      const parsed = JSON.parse(raw) as CacheFile
      // รูปแบบของเวอร์ชันเก่าที่อ่านไม่ออก ถือว่าไม่มีข้อมูล แล้วดึงใหม่ทับ (EC-CCH-03)
      if (parsed?.version !== FILE_VERSION || typeof parsed.months !== "object") return null
      return parsed
    } catch {
      return null
    }
  }

  return {
    async get(symbol, range) {
      const file = await read(symbol)
      if (!file) return []

      const current = now()
      const hits: MonthlyReturn[] = []
      for (const [month, entry] of Object.entries(file.months)) {
        if (compareMonths(month, range.start) < 0 || compareMonths(month, range.end) > 0) continue
        if (!Number.isFinite(entry?.value)) continue
        if (!isEntryUsable(month, entry, current)) continue
        hits.push({ month, value: entry.value })
      }
      return hits.sort((a, b) => compareMonths(a.month, b.month))
    },

    async put(symbol, returns) {
      try {
        const current = now()
        const existing = await read(symbol)
        const months: Record<string, CachedEntry> = existing?.months ?? {}
        for (const item of returns) {
          months[item.month] = {
            value: item.value,
            ...(isFreshMonth(item.month, current) ? { storedAt: current.getTime() } : {}),
          }
        }
        await mkdir(dir, { recursive: true })
        const payload: CacheFile = { version: FILE_VERSION, symbol, months }
        await writeFile(fileFor(symbol), JSON.stringify(payload), "utf8")
      } catch {
        // เขียนไม่ได้ (ดิสก์เต็ม/ไม่มีสิทธิ์) ไม่ใช่เหตุให้คำขอล้ม — ครั้งหน้าค่อยดึงใหม่
      }
    },
  }
}
