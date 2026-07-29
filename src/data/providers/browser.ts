import type { PriceProvider } from "@/types/series"
import { createStubProvider } from "./stub"

/**
 * จุดเดียวที่หน้าจอขอข้อมูลได้ (R15)
 *
 * ตอนนี้เป็นชุดข้อมูลจำลองล้วน เพราะแหล่งข้อมูลจริงต้องเรียกจากฝั่งเครื่องแม่ข่าย
 * (ชั้นคลังข้อมูลใช้ระบบไฟล์ จึงเข้ามาอยู่ในโค้ดฝั่งเบราว์เซอร์ไม่ได้)
 * เมื่อสลับเป็นข้อมูลจริงใน S8 ให้เปลี่ยนที่ไฟล์นี้ไฟล์เดียวเป็นการเรียกผ่านเส้นทางฝั่งแม่ข่าย
 * โดยหน้าจอไม่ต้องแก้อะไรเลย
 */
export function getBrowserProvider(): PriceProvider {
  return createStubProvider()
}
