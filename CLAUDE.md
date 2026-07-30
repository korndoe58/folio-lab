# CLAUDE.md

คำแนะนำสำหรับ Claude Code เมื่อทำงานกับ repo นี้

## ภาพรวม

folio-lab คือเครื่องมือ backtest พอร์ตลงทุน (Next.js App Router + TypeScript + Tailwind + shadcn/ui)
ที่รองรับกองทุนไทย/หุ้น SET/US ETF ในพอร์ตเดียว พร้อมจัดการสกุลเงิน THB/USD
เอกสารหลัก: [docs/ROADMAP.md](docs/ROADMAP.md) · แผนการทำงานรายรอบ: [docs/SESSION-PLAN.md](docs/SESSION-PLAN.md)

Next.js เวอร์ชันใน repo นี้มี breaking changes จากที่โมเดลเคยรู้จัก — อ่าน [AGENTS.md](AGENTS.md)
และเอกสารใน `node_modules/next/dist/docs/` ก่อนเขียนโค้ดที่แตะ API/convention ของ Next

## วิธีทำงาน (สำคัญ — อ่านก่อนแก้อะไร)

งานทุกชิ้นเดินผ่าน practice **story-first** — spec เป็นการ์ด story ที่ผูกกับ route จริง แล้วจึง implement
ตามการ์ดนั้น ไม่ใช่เขียนโค้ดก่อนแล้วค่อยเขียนเอกสารตาม

- **คู่มือปฏิบัติการฉบับเต็มอยู่ที่ `.claude/skills/write-story-epic/SKILL.md`** (ไฟล์นี้ไม่ขึ้น git โดยตั้งใจ
  — เป็นเครื่องมือส่วนตัว) มีสองโหมด: **MODE A** เขียน epic/story · **MODE B** implement การ์ดจนถึง ship
  พร้อมหลักฐาน อ่าน SKILL.md ก่อนเริ่มทุกครั้ง อย่าทำจากความจำ
- **การตัดสินใจเชิงผลิตภัณฑ์ทุกครั้ง** ต้องบันทึกเป็น `PD-###` ต่อท้าย
  [docs/product/decision-log.md](docs/product/decision-log.md) (append-only — ห้ามแก้ entry เก่า
  การกลับคำคือ entry ใหม่ + ทำเครื่องหมาย `♻ Superseded by PD-xxx` ที่ของเก่า)
- **การ์ดที่ `✅ Done` คือ as-built** — ห้ามแก้เนื้อย้อนหลัง ต้องการเปลี่ยน = US ใหม่

## คำสั่งที่ใช้บ่อย

- `npm run dev` — dev server (<http://localhost:3000>)
- `npm run build` / `npm run start` — build + serve production
- `npm run lint` · `npx tsc --noEmit` · `npx vitest run` — guard ชุดหลัก (ต้องเขียวก่อนปิดการ์ด)

## สถาปัตยกรรม (ห้ามข้ามชั้น)

| ชั้น | Path | รับผิดชอบ | ห้ามทำ |
| --- | --- | --- | --- |
| Engine | `src/engine/**` | คำนวณ metric ทั้งหมด — pure function ล้วน | `fetch`/fs/db/env, อ่านนาฬิกา, `Math.random()`, ไปหาข้อมูลเอง |
| Data | `src/data/providers/**` | คุยกับแหล่งข้อมูลภายนอก + normalize เป็น monthly series | คำนวณ metric; ถูกเรียกตรงจาก component |
| Cache | `src/data/cache/**` | เก็บ series ที่ normalize แล้ว (เดือนเก่าไม่เปลี่ยน = เก็บถาวรได้) | ตัดสินใจเชิงธุรกิจ |
| UI | `src/app/**`, `src/components/**` | รับ input, เรียก engine, แสดงผล | คำนวณ metric เอง แม้แต่บรรทัดเดียว; เรียก provider ตรง |
| Types | `src/types/**` | shared shapes | ถือ logic |

**PriceProvider** คือสัญญากลางของทุกแหล่งข้อมูล: `getMonthlySeries(symbol, range)` — เพิ่มตลาดใหม่
= เขียน provider ใหม่ ไม่ใช่แก้ engine `StubProvider` ให้ข้อมูลจำลองแบบ offline สำหรับเดิน route
ก่อนต่อข้อมูลจริง

**ความถูกต้องของตัวเลขมาก่อนเสมอ:** แตะ `src/engine/**` เมื่อไหร่ golden-fixture tests ต้องเขียว
(ชุดอ้างอิงอยู่ใน [docs/ROADMAP.md](docs/ROADMAP.md) ภาคผนวก A) metric ใหม่ต้องมีครบสามอย่างก่อน merge:
unit test + สูตร/หน่วยเวลาที่เขียนไว้ในการ์ด + tooltip ภาษาไทยใน UI

## UI และ copy

- ใช้ primitive ที่มีใน `src/components/ui/` ก่อนสร้างใหม่; ยึด shadcn (style base-nova บน Base UI) + Tailwind ตามที่มีอยู่
- **ลำดับการหา component ใหม่ (PD-008):** primitive ที่มี → ค้น shadcn studio
  (`npx shadcn search @shadcn-studio -q <คำ>` ติดตั้งด้วย `npx shadcn add @shadcn-studio/<item>` —
  CLI resolve ให้เอง ไม่ต้องแก้ components.json, ใช้เฉพาะ free tier) → ตรงสเปกการ์ดจึงใช้ ไม่ตรงจึงเขียนเอง
- **i18n:** ข้อความทุกอย่างผ่าน i18n layer มีคีย์ TH+EN — ห้าม hardcode ภาษาไทยใน JSX
- **ห้ามในข้อความที่ผู้ใช้เห็น:** ศัพท์ implementation (`provider`, `adapter`, `cache`, `API`, `endpoint`,
  `stub`, `mock`, `fixture`, `series`, `fetch`, `backend` และคำไทยทำนองเดียวกัน) — พูดสิ่งที่ผู้ใช้เห็นแทน
- **ศัพท์การเงิน** (CAGR, Sharpe, drawdown, DCA) ใช้ได้ แต่ต้องมี tooltip/คำอธิบายไทยตอนปรากฏครั้งแรกในจอ
- **หน้าผลลัพธ์ทุกหน้า** ต้องมีข้อความ "ผลในอดีตไม่ได้รับประกันผลตอบแทนในอนาคต · ไม่ใช่คำแนะนำการลงทุน"
- กราฟทุกตัวต้องมีตาราง/ข้อความเทียบเท่าให้ screen reader อ่านได้
- ตารางกว้างเลื่อนแนวนอนในกรอบตัวเอง — หน้าเว็บต้องไม่เลื่อนแนวนอนทั้งหน้า; ตรวจทั้ง light และ dark

## Code style

- TypeScript strict; ห้าม `any`
- ใช้ path alias `@/*` สำหรับ import จาก `src`
- comment เท่าที่จำเป็นจริง — ตั้งชื่อให้ดีและแยกฟังก์ชันเล็กแทน

## การตรวจสอบก่อนปิดงาน

รันเท่าที่เกี่ยวกับสิ่งที่แก้:

- เอกสารอย่างเดียว → ไม่ต้อง build
- แตะ `src/` → `npm run lint` + `npx tsc --noEmit` + `npx vitest run`
- แตะ routing / สัญญาข้อมูล / dependency → `npm run build` ด้วย
- **ก่อนตั้งการ์ดเป็น ✅ ทุกครั้ง:** เดิน route จริงในเบราว์เซอร์ด้วย params จริง กดปุ่มหลักทุกปุ่มที่การ์ดพูดถึง
  แล้วเก็บ screenshot ไว้ที่ `artifacts/evidence/US-NN/` — การอ่านโค้ดแล้วเชื่อว่าใช้ได้ ไม่นับเป็นหลักฐาน
- ถ้ารันคำสั่งไหนไม่ได้เพราะ dependency/env ไม่พร้อม ให้บอกตรง ๆ อย่าเดาผล
