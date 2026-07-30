import type { MonthRange } from "@/types/series"
import type { MonthlyRow } from "./chart-data"

/**
 * ไฟล์ตารางคำนวณของผลตอบแทนรายเดือน (US-21)
 *
 * เป็นฟังก์ชันบริสุทธิ์ทั้งไฟล์ เพื่อให้เทสต์จับได้ว่าเนื้อไฟล์ถูกต้องจริง —
 * เหลือแค่การสร้างไฟล์กับการกดดาวน์โหลดที่อยู่ในคอมโพเนนต์
 *
 * **ตัวเลขในไฟล์เป็นสัดส่วนดิบไม่ปัดเศษ** (BR-CMP-77) ต่างจากบนจอที่ปัดสองตำแหน่ง
 * เพราะจุดประสงค์ของไฟล์คือเอาไปคำนวณต่อ ถ้าปัดก่อนส่งออกจะได้ผลไม่ตรงกับที่เว็บแสดง
 */

const SEPARATOR = ","
const NEWLINE = "\r\n"

/**
 * เครื่องหมายนำหน้าไฟล์ที่บอกโปรแกรมตารางคำนวณว่าอ่านเป็นยูนิโคด (BR-CMP-76)
 * ขาดตัวนี้แล้วชื่อพอร์ตภาษาไทยจะกลายเป็นอักขระอ่านไม่ออกโดยที่ผู้ใช้ไม่รู้ว่าต้องตั้งค่าอะไร
 */
const BYTE_ORDER_MARK = "﻿"

export type MonthlyCsvInput = {
  rows: MonthlyRow[]
  /** ชื่อพอร์ตที่แสดงแล้ว เรียงตามลำดับพอร์ต */
  portfolioNames: string[]
  benchmarkSymbol: string
  range: MonthRange
  /** ป้ายบรรทัดหัวเรื่องที่ชั้นภาษาเตรียมมาให้ ไฟล์นี้จึงไม่ผูกกับภาษาใดภาษาหนึ่ง */
  title: string
  monthColumn: string
  summary: string
}

/**
 * เนื้อไฟล์ทั้งก้อน — บรรทัดหัวเรื่องบอกช่วงเวลา สกุลเงิน และสถานะปรับเงินเฟ้อ (BR-CMP-80)
 * เพื่อให้ไฟล์ที่หลุดจากบริบทยังอ่านออกว่าเป็นผลของการตั้งค่าแบบไหน
 */
export function buildMonthlyCsv(input: MonthlyCsvInput): string {
  const { rows, portfolioNames, benchmarkSymbol, title, monthColumn, summary } = input

  const header = [monthColumn, ...portfolioNames, benchmarkSymbol].map(escapeField)
  const body = rows.map((row) =>
    [row.month, ...row.values, row.benchmark].map(escapeField).join(SEPARATOR),
  )

  return (
    BYTE_ORDER_MARK +
    [escapeField(title), escapeField(summary), header.join(SEPARATOR), ...body].join(NEWLINE) +
    NEWLINE
  )
}

/**
 * ชื่อไฟล์ที่บอกได้ว่าเป็นผลของอะไร และไม่มีอักขระที่ระบบไฟล์ไม่รับ (BR-CMP-78)
 *
 * ต้องยอมรับ `\p{M}` ด้วย เพราะสระและวรรณยุกต์ไทย (เช่น ◌ื ใน "เดือน") เป็นเครื่องหมายประกอบ
 * ไม่ใช่ตัวอักษร — ถ้าคัดออกจะได้ชื่อไฟล์ที่สะกดผิดสำหรับผู้ใช้ที่การ์ดนี้ตั้งใจรองรับ
 */
export function csvFileName(range: MonthRange, prefix: string): string {
  const safe = prefix.replace(/[^\p{L}\p{M}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "")
  return `${safe}-${range.start}-${range.end}.csv`
}

/**
 * ค่าหนึ่งช่อง — ตัวเลขเขียนดิบทุกหลัก · ค่าที่ไม่มีเป็นช่องว่าง ไม่ใช่ศูนย์
 * ข้อความที่มีตัวคั่น เครื่องหมายคำพูด หรือขึ้นบรรทัดใหม่ ถูกครอบให้อ่านกลับได้ถูก (BR-CMP-79)
 */
function escapeField(value: string | number | null): string {
  if (value === null) return ""
  // ศูนย์พอดีต้องเป็น 0 ไม่ใช่ช่องว่าง (EC-CMP-31)
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""

  const needsQuotes = /[",\r\n]/.test(value)
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value
}
