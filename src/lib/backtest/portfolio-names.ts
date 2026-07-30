type Translate = (key: string, params?: Record<string, string | number>) => string

/**
 * ชื่อพอร์ตที่ใช้แสดงบนจอ (BR-CMP-16)
 *
 * พอร์ตเดียวที่ไม่ได้ตั้งชื่อเองใช้คำว่า "พอร์ต" เหมือนเดิม จอของการใช้งานปกติจึงไม่เปลี่ยนเลย
 * (BR-CMP-31) · ตั้งแต่สองพอร์ตขึ้นไปจึงเริ่มใส่เลขลำดับ เพราะเป็นตอนที่ต้องแยกให้ออกจริง ๆ
 */
export function resolvePortfolioNames(names: string[], t: Translate): string[] {
  return names.map((name, index) => {
    const trimmed = name.trim()
    if (trimmed !== "") return trimmed
    return names.length === 1
      ? t("summary.portfolioColumn")
      : t("form.portfolioDefaultName", { index: index + 1 })
  })
}
