# Session Plan — folio-lab

แผนลงมือทำ roadmap เป็นรอบ ๆ (session) ด้วย practice story-first
คู่กับ [ROADMAP.md](ROADMAP.md) (ทำอะไร/ทำไม) — ไฟล์นี้ตอบว่า **ทำเมื่อไหร่ ในรอบไหน จบรอบยังไงถึงเรียกว่าจบ**

- **วันที่:** 2026-07-29 · **สถานะ:** อนุมัติแล้ว รอเริ่ม S0
- **คู่มือปฏิบัติการ:** `.claude/skills/write-story-epic/SKILL.md` (เครื่องมือส่วนตัว ไม่อยู่ใน git)
- **การตัดสินใจที่มีผล:** [product/decision-log.md](product/decision-log.md) — PD-001 (practice),
  PD-002 (Anchor=Route + StubProvider), PD-003 (governance เบา)

---

## 1. Session คืออะไร

**1 session = งานก้อนเดียวที่ปิดจบได้** — ไม่ใช่ "ทำไปเรื่อย ๆ จนหมดแรง" ก้อนหนึ่งคือ
เขียน spec ของ epic หนึ่ง **หรือ** implement 1–3 story card **หรือ** spike หนึ่งเรื่อง
ห้ามคาบเกี่ยวข้ามก้อน เพราะจุดที่งานพังคือจุดที่หยุดกลางคันโดยไม่มีสถานะที่ชัด

**สามโหมด:**

| โหมด | ทำอะไร | ผลผลิต |
| --- | --- | --- |
| **AUTHOR** | เขียน epic + story cards (MODE A ของ skill) | `docs/product/stories/<epic>/…` สถานะ ⚪ Draft → PO อนุมัติเป็น 🟢 Ready |
| **IMPLEMENT** | ทำการ์ดที่ 🟢 Ready ให้เป็นโค้ดที่ ship ได้ (MODE B) | โค้ดใน `src/` + tests + หลักฐาน → การ์ดเป็น ✅ Done |
| **SPIKE** | ตอบคำถามที่ยังไม่รู้พอจะเขียน spec | รายงานใน `docs/spikes/` (append-only) + PD ถ้ามีการตัดสินใจ |

## 2. พิธีกรรมของทุก session

**เปิด session**
1. อ่าน [ROADMAP.md](ROADMAP.md) ส่วนของเฟสที่กำลังทำ + [decision-log.md](product/decision-log.md)
   ตั้งแต่ PD ล่าสุดที่ยังไม่ได้อ่าน
2. อ่าน `.claude/skills/write-story-epic/SKILL.md` (อย่าทำจากความจำ)
3. ประกาศโหมด + ขอบเขตของรอบนี้ให้ชัดก่อนแตะไฟล์แรก
4. โหมด IMPLEMENT: อ่าน Status ของทุกการ์ดที่จะแตะ — การ์ด ✅ Done ห้ามแก้เนื้อ (R5)

**ระหว่างทำ**
- อยู่ในขอบเขตที่ประกาศ เจอของนอกขอบเขต → จดเป็น Open Question ใน epic หรือ US ใหม่ ไม่ใช่ทำเลย
- ตัดสินใจเชิงผลิตภัณฑ์เมื่อไหร่ → หยุดเขียน PD ทันที ไม่ใช่รอจำตอนท้าย

**ปิด session**
1. guard ที่เกี่ยวข้องเขียว (ดูตารางใน SKILL.md)
2. โหมด IMPLEMENT: เดิน route จริง + screenshot ลง `artifacts/evidence/US-NN/` (R10/R17)
3. อัปเดต Status การ์ด + Change Log + ตาราง §7 ของ epic ให้ตรงกัน
4. PD ที่ตัดสินระหว่างทาง append แล้ว
5. commit ข้อความอ้าง `US-NN` (และ `PD-###` ถ้ามี)
6. อัปเดตแถวสถานะของ session นั้นในไฟล์นี้ + ตารางเฟสใน [README](../README.md) ถ้าปิดเฟส

**จบรอบไม่ได้ทำยังไง:** ถ้าเวลาหมดก่อน ให้ปิดที่สถานะที่ระบุได้ — การ์ดค้างที่ 🔨 In Dev พร้อมโน้ตว่า
ทำถึงไหน ดีกว่าปล่อยการ์ด 🟢 ที่โค้ดแก้ไปครึ่งทางโดยไม่มีร่องรอย

---

## 3. ตาราง session

> ประมาณการเป็นรอบทำงานแบบ part-time (1 session ≈ ครึ่งวันถึงหนึ่งวัน)
> **S0–S8 คือแกนบังคับ** (จบแล้วมีของ demo ครบ) · S9 เป็นต้นไปตัด/เลื่อน/สลับได้ตามเวลาและความสนใจ

### กลุ่ม A — วางฐาน + MVP (แกนบังคับ, จบที่ demo ได้)

#### S0 · SETUP — โครงโปรเจกต์
- **เป้าหมาย:** repo ที่ deploy ได้ตั้งแต่วันแรก
- **ทำ:** `git init` + commit เอกสารที่มีอยู่ · scaffold Next.js (App Router + TS strict + Tailwind +
  shadcn/ui) · ติดตั้ง vitest + Playwright · โครงโฟลเดอร์ตามชั้น R15 (`src/engine`, `src/data/providers`,
  `src/data/cache`, `src/types`) · ตั้ง i18n TH/EN · push GitHub + เชื่อม Vercel preview
- **Roadmap:** 0.1
- **จบเมื่อ:** `npm run dev` ขึ้นหน้าแรกได้ · lint/tsc/vitest/build เขียวทั้งสี่ · preview URL เปิดได้
- **หมายเหตุ:** เอกสาร (`CLAUDE.md`, `docs/`, `.gitignore`) มีอยู่แล้วก่อนเริ่ม S0 — รอบนี้คือ scaffold โค้ด

#### S1 · AUTHOR — spec เฟส 0–1
- **เป้าหมาย:** การ์ดพร้อมทำครบทั้งเฟส 0 และ 1
- **ทำ:** epic `foundation` (US-01..04) + epic `backtest-mvp` (US-05..11) · Lens 1–5 + Lens Q ครบทุกใบ ·
  ลงทะเบียนข้อความ validation ชุดแรกใน glossary
- **Roadmap:** spec ของ 0.2–1.7
- **จบเมื่อ:** ทุกการ์ดมี AC ที่ทดสอบได้ + verification plan + route/data mode · PO อนุมัติเป็น 🟢 Ready ·
  Open Questions ที่เหลือไม่บล็อกการเริ่ม

#### S2 · IMPLEMENT — ต่อท่อข้อมูล
- **การ์ด:** US-01 (PriceProvider + Stooq/Yahoo adapters + fallback) · US-02 (normalize เป็น monthly
  total-return series) · US-03 (cache ถาวร + StubProvider)
- **Roadmap:** 0.2, 0.3
- **จบเมื่อ:** unit tests ของ adapter/normalizer เขียว · ดึง VTI จริงได้ 1 ครั้งแล้วครั้งที่สองมาจาก cache
  (พิสูจน์ด้วย test หรือ log) · StubProvider คืนข้อมูลชุดคงที่แบบ offline ได้

#### S3 · IMPLEMENT — engine + golden tests
- **การ์ด:** US-04 (engine core: portfolioReturns, growth, CAGR, stdev, maxDrawdown, Sharpe, Sortino
  + golden fixtures)
- **Roadmap:** 0.4 → **ปิดเฟส 0**
- **จบเมื่อ:** golden fixture (ROADMAP ภาคผนวก A) ผ่านทุกค่าใน ±0.1% · ทุกฟังก์ชันเป็น pure (ไม่มี import
  network/fs/clock ใน `src/engine/**` — ตรวจด้วยสายตา + lint rule ถ้าตั้งได้)

#### S4 · IMPLEMENT — จอแรกที่กดได้
- **การ์ด:** US-05 (ฟอร์มตั้งพอร์ต: ticker + น้ำหนัก + เงินตั้งต้น + ช่วงเวลา + benchmark) ·
  US-06 (state อยู่ใน URL)
- **Roadmap:** 1.1
- **จบเมื่อ:** เดิน `/backtest` ด้วย stub ได้จริง · validation ครบตาม glossary · refresh แล้วค่าไม่หาย ·
  ลิงก์ที่ก๊อปไปเปิดใหม่ได้ค่าเดิม

#### S5 · IMPLEMENT — ผลลัพธ์ชุดแรก
- **การ์ด:** US-07 (รัน backtest + ตารางสรุป metric เทียบ benchmark)
- **Roadmap:** 1.2
- **จบเมื่อ:** ค่าบนจอตรงกับที่ engine test ยืนยัน · มีทั้ง 5 สถานะ UI · หน้าแสดง disclaimer การลงทุน ·
  ทุก metric มี tooltip ไทย (R16)

#### S6 · IMPLEMENT — กราฟ
- **การ์ด:** US-08 (กราฟมูลค่าพอร์ต + log scale) · US-09 (ผลตอบแทนรายปี chart + table)
- **Roadmap:** 1.3, 1.4
- **จบเมื่อ:** กราฟถูกต้องเทียบตัวเลขในตาราง · มีตาราง/ข้อความเทียบเท่าให้ screen reader ·
  ตรวจแล้วทั้ง light/dark และจอแคบ

#### S7 · IMPLEMENT — drawdown + ทางเข้าใช้งาน
- **การ์ด:** US-10 (กราฟ underwater + ตาราง drawdown ลึกสุด 5 อันดับ) · US-11 (พอร์ตตัวอย่าง 3 แบบ + landing)
- **Roadmap:** 1.5, 1.6
- **จบเมื่อ:** ค่า drawdown + เวลาฟื้นตรง golden · กดพอร์ตตัวอย่างแล้วเห็นผลครบโดยไม่ต้องกรอกเอง

#### S8 · SHIP + RETRO — เปิดใช้จริง 🎯
- **ทำ:** ต่อข้อมูลจริง (สลับจาก stub เป็น live) · deploy production · เดิน **ทุก AC ของ US-05..11**
  บน production URL เก็บ screenshot · เขียน README ฉบับ case study · retro รอบแรก
- **Roadmap:** 1.7 → **ปิดเฟส 1 = มีของ demo ครบ**
- **จบเมื่อ:** URL public ใช้งานได้ end-to-end · ทุกการ์ด US-01..11 เป็น ✅ พร้อมหลักฐาน ·
  บทเรียนบันทึกใน `.claude/skills/_retro/journal.md` · ROADMAP อัปเดตสถานะเฟส 0–1

### กลุ่ม B — ขยายความสามารถ (ตัด/เลื่อนได้)

#### S9 · AUTHOR — spec เฟส 2
- **ทำ:** epic `compare-cashflows` (US-12..17) · Lens Q ครบ · อัปเดต glossary
- **จบเมื่อ:** การ์ดครบทั้งเฟส 2 เป็น 🟢 Ready

#### S10 · IMPLEMENT — เทียบพอร์ต + เงินเข้าออก
- **การ์ด:** US-12 (เทียบ ≤3 พอร์ต) · US-13 (DCA/ถอนเงินงวด) · US-14 (rebalancing options)
- **Roadmap:** 2.1–2.3
- **จบเมื่อ:** ผล DCA + rebalance ตรวจทานกับคำนวณมือ 1 กรณี · ทุก chart/table รองรับหลายพอร์ต ·
  R13 sweep: component ที่ใช้ร่วมถูกปรับครบทุกที่ที่ render

#### S11 · IMPLEMENT — มุมมองเพิ่ม + แชร์
- **การ์ด:** US-15 (rolling returns) · US-16 (ตารางรายเดือน + export CSV) · US-17 (ลิงก์แชร์ที่สมบูรณ์)
- **Roadmap:** 2.4–2.6 → **ปิดเฟส 2**
- **จบเมื่อ:** ลิงก์แชร์เปิดซ้ำได้ผลเหมือนเดิม 100% · CSV เปิดใน spreadsheet ได้ถูกต้อง

#### S12 · SPIKE + AUTHOR — ตลาดไทย
- **ทำ:** spike ข้อมูลไทย (SEC Open Data: ความลึก NAV ย้อนหลัง, rate limit, การ map ชื่อกองทุน;
  แหล่งข้อมูลหุ้น SET; FX + CPI จาก ธปท.) → รายงานใน `docs/spikes/` → **แล้วค่อย** author epic
  `thai-market` ตามผลจริง
- **Roadmap:** 3.0 + spec ของ 3.1–3.4
- **จบเมื่อ:** รายงาน spike ตอบได้ว่าข้อมูลลึกพอไหม + ถ้าไม่พอจะใช้แผนสำรอง (นำเข้าไฟล์ NAV เอง) หรือไม่ ·
  PD บันทึกทางที่เลือก · การ์ดเฟส 3 เป็น 🟢 Ready
- **หมายเหตุ:** นี่คือจุดเดียวใน roadmap ที่ห้ามเขียน spec ก่อน — scope ขึ้นกับข้อมูลจริงล้วน ๆ

#### S13 · IMPLEMENT — สินทรัพย์ไทย
- **การ์ด:** US-18 (กองทุนรวมไทย: ค้นหา + NAV) · US-19 (หุ้น SET)
- **Roadmap:** 3.1, 3.2
- **จบเมื่อ:** backtest กองทุนไทยล้วนได้ผลถูกต้อง · provider ใหม่ไม่ต้องแก้ engine แม้แต่บรรทัดเดียว
  (ข้อพิสูจน์ของ R15 — บันทึกไว้ในหลักฐานการ์ด)

#### S14 · IMPLEMENT + RETRO — สกุลเงิน + เงินเฟ้อ
- **การ์ด:** US-20 (base currency THB/USD + แปลงด้วย FX รายเดือน) · US-21 (ปรับเงินเฟ้อไทย)
- **Roadmap:** 3.3, 3.4 → **ปิดเฟส 3**
- **จบเมื่อ:** พอร์ตผสม (กองทุนไทย 50% + VTI 50%, base THB) ตรวจทานกับคำนวณมือได้ · retro รอบสอง

### กลุ่ม C — เชิงลึก + AI (ทำเมื่ออยากใช้เองจริงจัง)

#### S15 · AUTHOR — spec เฟส 4
- **ทำ:** epic `risk-analytics` (US-22..27) — เน้นเขียน**นิยาม/สูตร/หน่วยเวลา**ของทุก metric ลงการ์ด (R16)
- **จบเมื่อ:** ทุก metric มีสูตร + แหล่งอ้างอิงค่าคาดหวังสำหรับ test

#### S16 · IMPLEMENT — ความสัมพันธ์ + การกระจายความเสี่ยง
- **การ์ด:** US-22 (correlation matrix) · US-23 (return/risk decomposition) · US-24 (risk metrics เต็มชุด:
  Beta/Alpha/R², VaR/CVaR, capture ratios, Calmar, skew/kurtosis, tracking error, information ratio)
- **Roadmap:** 4.1–4.3
- **จบเมื่อ:** ทุกค่าเทียบ golden fixture ตรงใน ±0.1% · ทุก metric มี tooltip ไทย

#### S17 · IMPLEMENT — วิกฤต + การถอนเงิน
- **การ์ด:** US-25 (historical stress periods) · US-26 (safe/perpetual withdrawal rate)
- **Roadmap:** 4.4, 4.5 → **ปิดเฟส 4**
- **จบเมื่อ:** ช่วงวิกฤตครอบคลุม COVID 2020 + เงินเฟ้อ 2022 (+ ต้มยำกุ้ง 2540 สำหรับสินทรัพย์ไทยที่ข้อมูลถึง)

#### S18 · AUTHOR — spec เฟส 5
- **ทำ:** epic `ai-layer` (US-27..30) — ออกแบบ prompt contract ให้ **ตัวเลขทุกตัวมาจาก engine เท่านั้น**
  และกำหนดวิธีตรวจว่าไม่ hallucinate
- **จบเมื่อ:** การ์ดระบุชัดว่าอะไรคือ input ที่ AI ได้เห็น และอะไรคือสิ่งที่ห้ามให้ AI คิดเอง

#### S19 · IMPLEMENT — AI layer
- **การ์ด:** US-27 (AI commentary ภาษาไทย) · US-28 (natural-language portfolio input + จอยืนยันก่อนรัน)
- **Roadmap:** 5.1, 5.2
- **จบเมื่อ:** ทดสอบ 5 พอร์ตแล้วตัวเลขใน commentary ตรงกับตารางทุกครั้ง · NL input ที่กำกวมถามกลับ
  ไม่ใช่เดา

#### S20 · SHIP + RETRO — ปิดโครงการ
- **การ์ด:** US-29 (Playwright E2E + วิดีโอ/รายงาน HTML เป็นหลักฐาน) · US-30 (case study writeup)
- **Roadmap:** 5.3, 5.4 → **ปิดเฟส 5**
- **จบเมื่อ:** E2E ครอบ flow หลักผ่านทั้งชุด พร้อม artifact · case study 1 หน้าอ่านจบเข้าใจทั้ง product
  และวิธีสร้าง · retro รอบสุดท้าย + สรุปว่ากฎข้อไหนคุ้มที่สุด (วัตถุดิบสำหรับเล่าตอนสัมภาษณ์)

---

## 4. ตารางไขว้ — feature ใน roadmap ↔ session

ทุก feature ใน [ROADMAP.md](ROADMAP.md) ต้องอยู่ใน session เดียวพอดี (ไม่ตกหล่น ไม่ซ้ำ)

| Feature | ชื่อ | Session |
| --- | --- | --- |
| 0.1 | Scaffold + CI | S0 |
| 0.2 | PriceProvider + adapters แรก | S2 |
| 0.3 | Normalization + cache | S2 |
| 0.4 | Engine core + golden tests | S3 |
| 1.1 | Portfolio config form | S4 |
| 1.2 | Summary metrics | S5 |
| 1.3 | Portfolio Growth chart | S6 |
| 1.4 | Annual Returns | S6 |
| 1.5 | Drawdowns | S7 |
| 1.6 | Demo portfolios + landing | S7 |
| 1.7 | Production deploy + README | S8 |
| 2.1 | เทียบ ≤3 พอร์ต | S10 |
| 2.2 | Cashflows (DCA/ถอน) | S10 |
| 2.3 | Rebalancing options | S10 |
| 2.4 | Rolling Returns | S11 |
| 2.5 | Monthly table + CSV | S11 |
| 2.6 | Shareable link | S11 |
| 3.0 | Spike: ข้อมูลตลาดไทย | S12 |
| 3.1 | กองทุนรวมไทย | S13 |
| 3.2 | หุ้น SET | S13 |
| 3.3 | Multi-currency THB/USD | S14 |
| 3.4 | Real returns เงินเฟ้อไทย | S14 |
| 4.1 | Correlation matrix | S16 |
| 4.2 | Return/Risk decomposition | S16 |
| 4.3 | Risk metrics เต็มชุด | S16 |
| 4.4 | Historical stress periods | S17 |
| 4.5 | Safe Withdrawal Rate | S17 |
| 5.1 | AI Portfolio Commentary | S19 |
| 5.2 | Natural-language input | S19 |
| 5.3 | Playwright E2E + evidence | S20 |
| 5.4 | Case-study writeup | S20 |

**Session ที่ไม่มี feature ตรง ๆ:** S1 · S9 · S15 · S18 (AUTHOR — ผลิต spec ของเฟสถัดไป)

## 5. ความคืบหน้า

| Session | โหมด | สถานะ | วันที่ปิด | บันทึก |
| --- | --- | --- | --- | --- |
| S0 | SETUP | ✅ เสร็จ | 2026-07-29 | guards เขียวทั้งสี่ + smoke 3/3 · repo: github.com/korndoe58/folio-lab · live: folio-lab-gamma.vercel.app (ตรวจแล้ว 200 + render ถูกทั้ง light/dark) · evidence ครบใน `artifacts/evidence/S0/` |
| S1 | AUTHOR | ✅ เสร็จ | 2026-07-29 | epic 2 ใบ + US-01..11 ครบทุก lens · audit อิสระพบ 21 จุด (P1 สี่จุดที่จะทำให้ golden ล้ม) แก้ครบแล้ว · PD-004/PD-005 · PO อนุมัติ → 🟢 Ready ทั้ง 11 ใบ |
| S2 | IMPLEMENT | ✅ เสร็จ | 2026-07-29 | US-01..03 ✅ Done · guards เขียวครบสี่ · tests 40 ผ่าน · ดึง VTI จริงครั้งเดียวแล้วครั้งที่สองมาจากคลัง (`artifacts/evidence/S2/`) · fixtures จริง 174 เดือน freeze แล้ว · PD-006 (Stooq ถูกบล็อก → Yahoo เป็นแหล่งหลัก) |
| S3 | IMPLEMENT | ✅ เสร็จ | 2026-07-29 | US-04 ✅ Done → **ปิดเฟส 0** · ชุดอ้างอิงเขียวทุกค่า (CAGR 10.31% vs 10.32%, Sharpe 0.78, MDD −23.55%) · tests 69 ผ่าน · เทสต์ความบริสุทธิ์ของ engine · PD-007 บันทึกส่วนต่างเดือนที่ฟื้นช่วง COVID |
| S4 | IMPLEMENT | ✅ เสร็จ | 2026-07-29 | US-05, US-06 ✅ Done · guards เขียวครบ · unit 101 ผ่าน · เดิน route จริงเป็นสคริปต์ 15 กรณีผ่านหมด (ข้อความครบ 8 รหัส, ลิงก์เปิดซ้ำได้, back ทำงาน) · หน้าแรกใช้ส่วนหัว/คำเตือนร่วม (R13) |
| S5 | IMPLEMENT | ✅ เสร็จ | 2026-07-29 | US-07 ✅ Done · ตาราง 9 แถวเทียบตลาด + คำอธิบายศัพท์ไทยทุกค่า · ค่าบนจอตรง golden (10.31%, 0.78, −23.55%) · guards เขียว · e2e 28/28 (สวีปชุดของ S4 ที่อ้างองค์ประกอบเดิม) |
| S6 | IMPLEMENT | ✅ เสร็จ | 2026-07-30 | US-08 + US-09 ✅ — กราฟเส้นมูลค่า (สลับสเกลลอการิทึม + ตารางสิ้นปี) และผลตอบแทนรายปี (แท่งคู่ + ตาราง) · ตัวเลขในกราฟตรงกับตารางสรุปทุกจุด · guards เขียวสี่ + e2e 37/37 |
| S7 | IMPLEMENT | ⚪ ยังไม่เริ่ม | — | |
| S8 | SHIP+RETRO | ⚪ ยังไม่เริ่ม | — | 🎯 จุดที่มีของ demo ครบ |
| S9 | AUTHOR | ⚪ ยังไม่เริ่ม | — | |
| S10 | IMPLEMENT | ⚪ ยังไม่เริ่ม | — | |
| S11 | IMPLEMENT | ⚪ ยังไม่เริ่ม | — | |
| S12 | SPIKE+AUTHOR | ⚪ ยังไม่เริ่ม | — | scope ขึ้นกับผล spike |
| S13 | IMPLEMENT | ⚪ ยังไม่เริ่ม | — | |
| S14 | IMPLEMENT+RETRO | ⚪ ยังไม่เริ่ม | — | |
| S15 | AUTHOR | ⚪ ยังไม่เริ่ม | — | |
| S16 | IMPLEMENT | ⚪ ยังไม่เริ่ม | — | |
| S17 | IMPLEMENT | ⚪ ยังไม่เริ่ม | — | |
| S18 | AUTHOR | ⚪ ยังไม่เริ่ม | — | |
| S19 | IMPLEMENT | ⚪ ยังไม่เริ่ม | — | |
| S20 | SHIP+RETRO | ⚪ ยังไม่เริ่ม | — | ปิดโครงการ |
