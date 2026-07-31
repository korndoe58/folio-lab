import { monthsBetween, type MonthlyReturn, type YearMonth } from "@/types/series"

/**
 * ผลตอบแทนช่วงวิกฤต (US-32)
 *
 * **ช่วงเป็นวันที่ตรึงไว้ในโค้ด ไม่ใช่ค่าที่หาเอาจากข้อมูล** (BR-RSK-43) — ทุกพอร์ตจึงถูกวัด
 * ด้วยช่วงเดียวกันและเทียบกันได้ · ถ้าปล่อยให้แต่ละพอร์ตหาช่วงตกของตัวเอง ตารางนี้จะกลายเป็น
 * ตารางช่วงขาดทุนอีกใบ ซึ่งมีอยู่แล้ว
 *
 * **สองช่วงตรงกับช่วงขาดทุนของพอร์ตอ้างอิงพอดี** (2022 และ 2015–16) จึงใช้เป็นค่าอ้างอิง
 * ที่อิสระจากสูตรของเราได้ · อีกสองช่วงเดือนเริ่มคลาดกันหนึ่งเดือนโดยตั้งใจ เพราะยึดชื่อ
 * ที่คนจำได้เป็นหลัก ([PD-025](../../docs/product/decision-log.md))
 */

export type StressPeriod = {
  /** คีย์ i18n ของชื่อเหตุการณ์และคำอธิบาย */
  key: string
  start: YearMonth
  end: YearMonth
}

/**
 * ชุดช่วงเริ่มต้นสี่ช่วง (BR-RSK-49)
 * ทุกช่วงอยู่ในกรอบข้อมูลที่โปรเจกต์มี คือตั้งแต่ 2012 (BR-RSK-48)
 */
export const STRESS_PERIODS: StressPeriod[] = [
  { key: "covid2020", start: "2020-02", end: "2020-03" },
  { key: "inflation2022", start: "2022-01", end: "2022-09" },
  { key: "selloff2018", start: "2018-10", end: "2018-12" },
  { key: "china2015", start: "2015-06", end: "2016-02" },
]

/** ปีแรกสุดที่ตารางนี้ดูย้อนได้ ตามข้อมูลที่มี (BR-RSK-48) */
export const STRESS_EARLIEST_YEAR = 2012

/**
 * ผลของหนึ่งช่วง = **ผลตอบแทนทบต้นของเดือนทั้งหมดในช่วงนั้น** ไม่แปลงเป็นรายปี (BR-RSK-44)
 * เพราะช่วงส่วนใหญ่สั้นกว่าหนึ่งปี การแปลงจะได้ตัวเลขที่เว่อร์เกินจริง
 *
 * **ข้อมูลครอบคลุมไม่ครบทั้งช่วง → คืนไม่มีค่า** ไม่ใช่คำนวณจากเดือนที่มีบางส่วน
 * แล้วแสดงเหมือนเป็นค่าเต็ม (BR-RSK-46)
 */
export function stressReturn(
  returns: MonthlyReturn[],
  period: StressPeriod,
): number | null {
  const covered = returns.filter(
    (item) => item.month >= period.start && item.month <= period.end,
  )

  // นับเดือนที่ช่วงนี้ต้องมี แล้วเทียบกับที่มีจริง — เข้มกว่าการดูแค่เดือนแรกกับเดือนสุดท้าย
  const expected = monthsBetween(period.start, period.end) + 1
  if (covered.length < expected) return null

  return covered.reduce((growth, item) => growth * (1 + item.value), 1) - 1
}
