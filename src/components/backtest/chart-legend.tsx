"use client"

import {
  BENCHMARK_DASH,
  CONTRIBUTION_DASH,
  barOpacity,
  lineDash,
  lineWidth,
} from "@/components/backtest/series-style"

/**
 * หนึ่งบรรทัดของป้ายกำกับ — ตัวอย่างลายบวกชื่อของชุดข้อมูลนั้น (BR-LOOP-07)
 * `muted` = ใช้สีจางเหมือนที่ชุดนั้นถูกวาดในกราฟ (BR-LOOP-12)
 */
export type LegendItem = { label: string; muted?: boolean } & (
  | { kind: "line"; dash?: string; width: number }
  | { kind: "bar"; opacity: number; outline?: boolean }
)

/**
 * ตัวสร้างรายการป้าย — **ค่าลายมาจาก `series-style.ts` ที่เดียว** ทั้งในกราฟและในป้าย
 * (BR-LOOP-03) · ถ้าใครแก้ลายในไฟล์นั้น ป้ายเปลี่ยนตามเองโดยไม่ต้องตามแก้สองที่
 */
export const portfolioLine = (label: string, index: number): LegendItem => ({
  kind: "line",
  label,
  dash: lineDash(index),
  width: lineWidth(index),
})

export const portfolioBar = (label: string, index: number): LegendItem => ({
  kind: "bar",
  label,
  opacity: barOpacity(index),
  // แท่งที่จางมาก (0.18) จะแทบมองไม่เห็นถ้าไม่มีเส้นขอบ กราฟจึงตีขอบให้ทุกแท่ง
  outline: true,
})

export const benchmarkLine = (label: string): LegendItem => ({
  kind: "line",
  label,
  dash: BENCHMARK_DASH,
  width: 1.5,
  muted: true,
})

/** แท่งตัวเทียบในกราฟรายปีเป็นกรอบเปล่า ไม่ถมสี */
export const benchmarkBar = (label: string): LegendItem => ({
  kind: "bar",
  label,
  opacity: 0,
  outline: true,
  muted: true,
})

export const contributionLine = (label: string): LegendItem => ({
  kind: "line",
  label,
  dash: CONTRIBUTION_DASH,
  width: 1.5,
  muted: true,
})

const SWATCH_WIDTH = 24
const SWATCH_HEIGHT = 8

function Swatch({ item }: { item: LegendItem }) {
  return (
    // ภาพประกอบล้วน — ความหมายอยู่ในข้อความข้าง ๆ อยู่แล้ว (BR-LOOP-08)
    <svg
      aria-hidden="true"
      width={SWATCH_WIDTH}
      height={SWATCH_HEIGHT}
      viewBox={`0 0 ${SWATCH_WIDTH} ${SWATCH_HEIGHT}`}
      className="shrink-0"
    >
      {item.kind === "line" ? (
        <line
          x1={0}
          y1={SWATCH_HEIGHT / 2}
          x2={SWATCH_WIDTH}
          y2={SWATCH_HEIGHT / 2}
          stroke="currentColor"
          strokeWidth={item.width}
          strokeDasharray={item.dash}
        />
      ) : (
        <rect
          x={0.5}
          y={0.5}
          width={SWATCH_WIDTH - 1}
          height={SWATCH_HEIGHT - 1}
          fill="currentColor"
          fillOpacity={item.opacity}
          stroke={item.outline ? "currentColor" : "none"}
          strokeWidth={1}
        />
      )}
    </svg>
  )
}

/**
 * ป้ายกำกับใต้กราฟ (US-34)
 *
 * กราฟแยกพอร์ตด้วยลายไม่ใช่สีตาม BR-CMP-28 — ป้ายจึงต้องวาดลายจริงให้ดู ไม่ใช่บอกแค่ชื่อ
 * มิฉะนั้นทุกบรรทัดจะหน้าตาเหมือนกันหมดและไม่ช่วยอะไร ([PD-021](../../../docs/product/decision-log.md))
 *
 * วางเป็นพี่น้อง**ถัดจาก**กรอบกราฟ ไม่ใช่ข้างใน เพื่อไม่ให้ตัวนับที่ผูกกับกรอบกราฟ
 * เปลี่ยนความหมาย
 */
export function ChartLegend({ items, testId }: { items: LegendItem[]; testId?: string }) {
  if (items.length === 0) return null

  return (
    <ul
      role="list"
      data-testid={testId}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
    >
      {items.map((item) => (
        <li
          key={item.label}
          className={`flex items-center gap-1.5 ${item.muted ? "text-muted-foreground" : "text-primary"}`}
        >
          <Swatch item={item} />
          <span className="text-muted-foreground">{item.label}</span>
        </li>
      ))}
    </ul>
  )
}
