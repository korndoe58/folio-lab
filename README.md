# folio-lab

เครื่องมือ backtest พอร์ตลงทุนแนว [Portfolio Visualizer](https://www.portfoliovisualizer.com/backtest-portfolio)
ที่รองรับ **กองทุนรวมไทย / หุ้น SET / US ETF ในพอร์ตเดียว** พร้อมจัดการสกุลเงิน THB/USD
และมี **AI commentary ภาษาไทย** อธิบายผลการลงทุนเป็นภาษาคน

**Live:** <https://folio-lab-gamma.vercel.app> · **สถานะ:** Session S0 เสร็จสมบูรณ์ — พร้อมเริ่ม S1 (เขียน spec เฟส 0–1)

- [docs/ROADMAP.md](docs/ROADMAP.md) — roadmap + feature breakdown (what/why) ทั้ง 6 เฟส
- [docs/SESSION-PLAN.md](docs/SESSION-PLAN.md) — แผนลงมือทำ 21 รอบ (session) พร้อมเกณฑ์ปิดรอบ
- [docs/product/decision-log.md](docs/product/decision-log.md) — บันทึกการตัดสินใจ (append-only)
- [CLAUDE.md](CLAUDE.md) — conventions ของ repo (สถาปัตยกรรม, copy, การตรวจสอบ)

## ทำไมต้องมี

- Portfolio Visualizer ไม่รองรับกองทุนไทย/หุ้นไทย และไม่เข้าใจพอร์ตผสมสกุลเงินแบบที่นักลงทุนไทยถือจริง
- ผล backtest เป็นตาราง metric ล้วน ๆ — คนไม่ใช่สาย finance อ่านไม่ออก
- Project นี้เป็นทั้งเครื่องมือใช้จริงและ portfolio piece โชว์การสร้าง product แบบ AI-first
  (Claude Code, spec-driven, golden-fixture testing, Playwright evidence)

## Stack (ตัดสินใจแล้ว)

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, engine คำนวณเป็น pure TypeScript
มี unit test เทียบ golden fixtures, ข้อมูลราคาผ่าน adapter (Stooq/Yahoo → SEC Open Data / BOT API),
deploy บน Vercel

## โครงเฟส

| Phase | ของที่ได้ | Session | สถานะ |
|---|---|---|---|
| 0 | Foundation: scaffold, data adapters + cache, engine core + golden tests | S0–S3 | ⚪ ยังไม่เริ่ม |
| 1 | 🎯 MVP: backtest พอร์ตเดียว + benchmark, growth/annual/drawdown, deploy public | S4–S8 | ⚪ ยังไม่เริ่ม |
| 2 | เทียบ ≤3 พอร์ต, DCA/ถอน, rebalancing, rolling returns, shareable link | S9–S11 | ⚪ ยังไม่เริ่ม |
| 3 | 🇹🇭 กองทุนไทย + หุ้น SET + multi-currency + เงินเฟ้อไทย | S12–S14 | ⚪ ยังไม่เริ่ม |
| 4 | Risk analytics เชิงลึก: correlations, decomposition, VaR/CVaR, stress periods, SWR | S15–S17 | ⚪ ยังไม่เริ่ม |
| 5 | 🤖 AI commentary, NL portfolio input, E2E evidence, case-study writeup | S18–S20 | ⚪ ยังไม่เริ่ม |

## วิธีทำงาน

Spec เป็น story card ผูกกับ route จริง (ไม่มีโฟลเดอร์ prototype แยก) → implement ตามการ์ด →
ปิดการ์ดด้วยหลักฐาน (guards เขียว + เดิน route จริง + screenshot) ไม่ใช่ด้วยความรู้สึกว่าเสร็จ ·
การ์ดที่ ship แล้วห้ามแก้ย้อนหลัง รายละเอียดอยู่ใน [docs/SESSION-PLAN.md](docs/SESSION-PLAN.md) §1–2
