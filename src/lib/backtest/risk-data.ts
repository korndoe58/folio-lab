import {
  correlationMatrix,
  decomposePortfolio,
  type AssetContribution,
  type CorrelationMatrix,
} from "@/engine"
import type { MonthlyReturn } from "@/types/series"

/**
 * ข้อมูลของสองส่วนรายสินทรัพย์ (US-28, US-29)
 *
 * ไฟล์นี้ทำได้แค่เรียกชั้นคำนวณให้ครบทุกพอร์ตแล้วจัดเรียง — ไม่มีการคำนวณทางการเงินใหม่
 * วัตถุดิบคือชุดผลตอบแทนรายสินทรัพย์ที่ถูกตัดช่วงร่วมมาแล้ว บวกน้ำหนักรายเดือน
 * จาก `portfolioReturns` ([PD-023](../../../docs/product/decision-log.md))
 */

/** สินทรัพย์หนึ่งตัวในพอร์ตหนึ่ง พร้อมของที่ชั้นคำนวณต้องใช้ */
export type RiskAsset = {
  symbol: string
  /** น้ำหนักเป้าหมายเป็นเปอร์เซ็นต์ที่ผู้ใช้กรอก */
  weight: number
  returns: MonthlyReturn[]
}

export type RiskPortfolio = {
  assets: RiskAsset[]
  /** น้ำหนักจริง ณ ต้นเดือน จาก `PortfolioResult.weights` */
  monthlyWeights: number[][]
  returns: MonthlyReturn[]
  /** กำไรรวมเป็นเงิน = มูลค่าสุดท้าย − เงินที่ใส่ทั้งหมด */
  profit: number
}

export type RiskData = {
  /** หนึ่งชุดต่อพอร์ต เรียงตามลำดับพอร์ตในฟอร์ม */
  correlations: CorrelationMatrix[]
  decompositions: AssetContribution[][]
}

export function buildRiskData(
  portfolios: RiskPortfolio[],
  benchmark: { symbol: string; returns: MonthlyReturn[] },
): RiskData {
  return {
    // ตารางครอบคลุมทุกสินทรัพย์ในพอร์ตนั้น **บวกตัวเทียบ** (BR-RSK-28)
    correlations: portfolios.map((portfolio) =>
      correlationMatrix([
        ...portfolio.assets.map((asset) => ({ label: asset.symbol, returns: asset.returns })),
        { label: benchmark.symbol, returns: benchmark.returns },
      ]),
    ),
    decompositions: portfolios.map((portfolio) => {
      const total = portfolio.assets.reduce((sum, asset) => sum + asset.weight, 0)
      return decomposePortfolio({
        assets: portfolio.assets.map((asset) => ({
          label: asset.symbol,
          targetWeight: total > 0 ? asset.weight / total : 0,
          returns: asset.returns,
        })),
        monthlyWeights: portfolio.monthlyWeights,
        portfolio: portfolio.returns,
        profit: portfolio.profit,
      })
    }),
  }
}
