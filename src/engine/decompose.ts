import type { MonthlyReturn } from "@/types/series"
import { mean, sampleStdev } from "./metrics"

/**
 * แยกส่วนผลตอบแทนและความเสี่ยงรายสินทรัพย์ (US-29)
 *
 * **สองค่านี้ใช้น้ำหนักคนละแบบโดยตั้งใจ:**
 * - ส่วนแบ่งผลตอบแทนใช้ **น้ำหนักจริงรายเดือน** เพราะกำไรของเดือนนั้นเกิดจากสัดส่วนที่ถืออยู่จริง
 *   ไม่ใช่สัดส่วนที่ตั้งไว้ตอนแรก (BR-RSK-35) — น้ำหนักชุดนี้มาจาก `portfolioReturns`
 *   ที่คำนวณไว้แล้ว ไม่ได้คำนวณซ้ำ ([PD-023](../../docs/product/decision-log.md))
 * - ส่วนแบ่งความเสี่ยงใช้ **น้ำหนักเป้าหมาย** ตามนิยามมาตรฐาน (BR-RSK-37)
 *
 * **ตัวหาร `n−1` มีผลจริงกับเมทริกนี้** ต่างจากความสัมพันธ์ที่ตัวหารตัดกันหมด (BR-RSK-38)
 */

export type DecomposeAsset = {
  label: string
  /** น้ำหนักเป้าหมายที่ผู้ใช้กรอก — รวมกันเป็น 1 */
  targetWeight: number
  returns: MonthlyReturn[]
}

export type AssetContribution = {
  label: string
  targetWeight: number
  /** กำไรทั้งหมดของพอร์ตมาจากตัวนี้กี่ส่วน — ไร้หน่วย (BR-RSK-35) */
  returnShare: number | null
  /** ส่วนแบ่งกำไรคิดเป็นเงิน (BR-RSK-36) */
  contributionAmount: number | null
  /** ความเหวี่ยงของพอร์ตมาจากตัวนี้กี่ส่วน · **ติดลบได้** (BR-RSK-37, BR-RSK-39) */
  riskShare: number | null
}

/** ความแปรปรวนร่วมแบบตัวอย่าง (ตัวหาร n−1) */
function sampleCovariance(a: number[], b: number[]): number | null {
  if (a.length < 2) return null
  const avgA = mean(a)
  const avgB = mean(b)
  return a.reduce((sum, value, i) => sum + (value - avgA) * (b[i] - avgB), 0) / (a.length - 1)
}

export function decomposePortfolio(input: {
  assets: DecomposeAsset[]
  /** น้ำหนักจริง ณ ต้นเดือน เรียงตามเดือนเดียวกับ `portfolio` (PD-023) */
  monthlyWeights: number[][]
  /** ชุดผลตอบแทนของพอร์ตที่น้ำหนักชุดนั้นสร้างขึ้น */
  portfolio: MonthlyReturn[]
  /** กำไรรวมเป็นเงิน ใช้แปลงส่วนแบ่งเป็นจำนวนเงิน — ไม่ส่งมา = ไม่คิดส่วนนั้น */
  profit?: number
}): AssetContribution[] {
  const { assets, monthlyWeights, portfolio, profit } = input

  /** ผลรวมของ (น้ำหนักจริงเดือนนั้น × ผลตอบแทนเดือนนั้น) ของแต่ละตัว */
  const weighted = assets.map((asset, i) =>
    asset.returns.reduce((sum, item, monthIndex) => {
      const weight = monthlyWeights[monthIndex]?.[i]
      return weight === undefined ? sum : sum + weight * item.value
    }, 0),
  )
  const weightedTotal = weighted.reduce((sum, value) => sum + value, 0)

  const portfolioValues = portfolio.map((item) => item.value)
  const portfolioStdev = sampleStdev(portfolioValues)
  // ทุกเดือนเท่ากันหมด → ความแปรปรวนศูนย์ → ส่วนแบ่งความเสี่ยงไม่มีค่า (BR-RSK-41)
  const portfolioVariance =
    portfolioStdev === null || portfolioStdev === 0 ? null : portfolioStdev ** 2

  return assets.map((asset, i) => {
    const returnShare = weightedTotal === 0 ? null : weighted[i] / weightedTotal

    const covariance = sampleCovariance(
      asset.returns.map((item) => item.value),
      portfolioValues,
    )
    const riskShare =
      portfolioVariance === null || covariance === null
        ? null
        : (asset.targetWeight * covariance) / portfolioVariance

    return {
      label: asset.label,
      targetWeight: asset.targetWeight,
      returnShare,
      contributionAmount: returnShare === null || profit === undefined ? null : returnShare * profit,
      riskShare,
    }
  })
}
