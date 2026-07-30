/**
 * ลายของแต่ละพอร์ตบนกราฟ (BR-CMP-28)
 *
 * แยกกันได้ **โดยไม่พึ่งสี** — ลายเส้นและความทึบต่างกันชัดพอที่จะอ่านออกเมื่อพิมพ์ขาวดำ
 * หรือเมื่อผู้ใช้แยกสีไม่ออก · ต่อยอดจาก BR-GRW-06 ที่ใช้ลายแยกพอร์ตกับตัวเทียบอยู่แล้ว
 */

/** ลายเส้นของพอร์ตลำดับที่ 1 ถึง 3 — undefined = เส้นทึบ */
const LINE_DASH: Array<string | undefined> = [undefined, "10 4", "2 3"]

/** ความทึบของแท่งกราฟรายปี ไล่จากทึบไปโปร่ง */
const BAR_OPACITY = [1, 0.55, 0.18]

/** ตัวเทียบใช้ลายเดิมที่ ship มาตั้งแต่ US-08 จึงไม่เปลี่ยนหน้าตาของพอร์ตเดียว */
export const BENCHMARK_DASH = "5 4"

export function lineDash(index: number): string | undefined {
  return LINE_DASH[index % LINE_DASH.length]
}

export function barOpacity(index: number): number {
  return BAR_OPACITY[index % BAR_OPACITY.length]
}

/** ความหนาของเส้น — พอร์ตแรกหนาสุดเพราะเป็นชุดที่ผู้ใช้ตั้งก่อน */
export function lineWidth(index: number): number {
  return index === 0 ? 2 : 1.75
}
