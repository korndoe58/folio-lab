# folio-lab — Roadmap & Feature Breakdown

> เครื่องมือ Backtest พอร์ตลงทุนแนว [Portfolio Visualizer](https://www.portfoliovisualizer.com/backtest-portfolio)
> ที่รองรับ **กองทุนรวมไทย/หุ้นไทย + พอร์ตผสม USD/THB** และมี **AI layer** อธิบายพอร์ตเป็นภาษาคน

- **สถานะ:** ✅ เฟส 0, 1 และ **3 (ตลาดไทย)** เสร็จแล้ว (ใช้งานจริงที่ folio-lab-gamma.vercel.app)
  — เฟส 3 ยกมาก่อนเฟส 2 ตาม PD-011 และปิดเท่าที่แหล่งข้อมูลเปิดให้ทำ (กองทุนรวมไทย ⏸ รอคีย์ ก.ล.ต.
  ตาม PD-012) — ถัดไป**เฟส 2 เทียบพอร์ตและเงินเข้าออก** ซึ่ง**เขียน spec ครบแล้วที่ S14** และ
  พร้อมลงมือที่ S15
- **วันที่เขียน:** 2026-07-28
- **เจ้าของ:** Supakorn Rattanapet
- **บทบาทของ project:** (1) Portfolio piece ประกอบการสมัครงานสาย AI Builder (2) เครื่องมือ backtest ใช้เองจริง

---

## 1. Positioning & เหตุผลที่ทำ (Why this project)

**ปัญหา:** Portfolio Visualizer คือมาตรฐานของการ backtest พอร์ตแบบ DIY แต่ (1) ไม่รองรับกองทุนรวมไทย/หุ้น SET
(2) ไม่เข้าใจพอร์ตผสมสกุลเงินแบบที่นักลงทุนไทยถือจริง (กองทุนไทย + US ETF) (3) ฟีเจอร์ดี ๆ ถูกย้ายไปหลัง paywall
มากขึ้นเรื่อย ๆ (4) อธิบายผลเป็นตาราง metric ล้วน ๆ — คนไม่ใช่สาย finance อ่านไม่ออก

**คำตอบของ folio-lab:**

| จุดขาย | ทำไมถึงสำคัญ |
|---|---|
| Backtest กองทุนไทย + หุ้น SET + US ETF ในพอร์ตเดียว | ไม่มี tool ฟรีเจ้าไหนทำดี — และตรงกับพอร์ตจริงของนักลงทุนไทย (รวมของเจ้าของ project เอง) |
| จัดการสกุลเงิน THB/USD อย่างถูกต้อง (เลือก base currency) | พอร์ตผสมสกุลเงินคือจุดที่ spreadsheet ทำเองแล้วผิดบ่อยที่สุด |
| AI commentary ภาษาไทย | เปลี่ยนตาราง metric เป็นคำอธิบายที่คนทั่วไปเข้าใจ — และเป็นหลักฐานทักษะ AI Builder |
| Open, deploy public บน Vercel | ใช้ demo ได้ทันทีในบริบทสมัครงาน ไม่ต้อง setup |

**บทบาทคู่ (dual purpose) กำหนดวิธีเรียง roadmap:**
- โชว์ได้เร็ว → Phase 1 จบแล้วต้องมี URL ที่ demo ให้ recruiter ดูจบในตัว
- ใช้จริงได้ลึก → Phase 3–4 ค่อยเติมตลาดไทย + risk analytics ที่ทำให้เลิกใช้ spreadsheet ได้จริง

---

## 2. Feature inventory ของต้นแบบ (Portfolio Visualizer — สำรวจจริง 2026-07-28)

สิ่งที่หน้า Backtest Portfolio ของต้นแบบมี (ใช้เป็น checklist ว่า clone อะไร / ตัดอะไร):

**Input:** พอร์ตสูงสุด 3 พอร์ต (ticker + weight), ช่วงเวลา (ปี/เดือน), เงินตั้งต้น, cashflow
(DCA รายงวด / ถอนคงที่ / ถอนเป็น %), rebalancing (ไม่ทำ / รายปี / รายไตรมาส / รายเดือน / bands),
reinvest dividends, benchmark

**Output:** Performance Summary (CAGR, Stdev, Best/Worst Year, Max Drawdown, Sharpe, Sortino,
Active Return, Tracking Error, Information Ratio, Correlation), Portfolio Growth chart, Annual Returns
chart+table, Monthly Returns table, Trailing Returns, Drawdown chart + worst-10 drawdowns +
stress periods (COVID ฯลฯ), Rolling Returns (1/3/5/7/10 ปี), Risk metrics เต็มชุด (VaR/CVaR,
Beta/Alpha/R², Capture ratios, Skewness/Kurtosis, Calmar, SWR/PWR), Correlation matrix,
Return/Risk decomposition ราย asset, Holdings-based style analysis (ใช้ข้อมูล Morningstar),
Insights, Export PDF/Excel, Shareable link

**ตัดออกอย่างตั้งใจ (Later/Never):** ดูข้อ 6

---

## 3. สถาปัตยกรรม (ตัดสินใจแล้ว)

```
Next.js (App Router, TypeScript, Tailwind, shadcn/ui) — deploy Vercel
│
├─ UI layer          หน้า config พอร์ต + หน้า results (charts: Recharts)
│                    state ของ backtest ทั้งหมดอยู่ใน URL query → shareable link ฟรี
│
├─ Engine (pure TS)  src/engine/* — ฟังก์ชันคำนวณล้วน ไม่แตะ network/DB
│                    input: monthly return series → output: ทุก metric
│                    unit test (vitest) เทียบ golden fixtures (ภาคผนวก A)
│
├─ Data layer        PriceProvider interface — adapter ต่อ 1 แหล่งข้อมูล
│   ├─ StooqProvider     (US ETF/หุ้น US — CSV ฟรี, primary)
│   ├─ YahooProvider     (fallback + adjusted close รวมปันผล)
│   ├─ SecThFundProvider (NAV กองทุนไทย — SEC Open Data API, Phase 3)
│   ├─ SetProvider       (หุ้น SET, Phase 3 — spike ก่อน)
│   └─ BotProvider       (FX THB/USD + CPI ไทย — Bank of Thailand API, Phase 3)
│
└─ Cache             ราคา normalize เป็น monthly series แล้ว cache ถาวร
                     (local: SQLite / prod: Vercel KV หรือ blob) — ลด dependency ต่อ free API
```

**หลักการที่ล็อกไว้:**
1. **Engine เป็น pure function 100%** — คำนวณจาก series ที่ inject เข้าไป ทำให้ test ได้แบบ deterministic
   และเป็นจุดโชว์คุณภาพโค้ดใน case study
2. **ทุกแหล่งข้อมูลอยู่หลัง adapter + cache** — ความเสี่ยงอันดับ 1 ของ project ประเภทนี้คือ free API
   เปลี่ยน/ล่ม/โดน block ต้อง contain ไว้ที่ชั้นเดียว
3. **หน่วยคำนวณคือ monthly total-return series** — เท่ากับต้นแบบ, ข้อมูลเบา, metric มาตรฐานทั้งหมด
   นิยามบน monthly ได้; ใช้ adjusted close เป็นตัวแทน total return (ข้อจำกัด: ไม่แยกปันผลออกมาแสดง)
4. **ไม่มี auth ใน MVP** — saved portfolios ใช้ localStorage; แชร์ผ่าน URL

---

## 4. Roadmap รายเฟส

> ประมาณการเป็น "สัปดาห์แบบ part-time + AI-first workflow (Claude Code)" — จุดที่ demo ได้ครั้งแรกคือจบ Phase 1

### Phase 0 — Foundation (~1 สัปดาห์)

เป้าหมาย: วางโครงที่ทำให้ทุก phase ถัดไปเร็วและไม่พังย้อนหลัง — ยังไม่มีหน้าจอผู้ใช้จริง

| # | Feature | What (ทำอะไร) | Why (ทำไม) |
|---|---|---|---|
| 0.1 | Scaffold + CI | Next.js + TS strict + Tailwind + shadcn, vitest, lint, GitHub repo + Vercel preview deploy | ให้ "deploy ได้ตั้งแต่ commit แรก" — โชว์วินัย ship-early และกัน integration พังทีหลัง |
| 0.2 | PriceProvider interface + Stooq/Yahoo adapters | สัญญากลาง `getMonthlySeries(symbol, range)` + adapter 2 ตัวแรก + fallback logic | กักความเสี่ยง free API ไว้ชั้นเดียว; เพิ่มตลาดไทยใน Phase 3 ได้โดยไม่แตะ engine |
| 0.3 | Series normalization + cache | แปลง daily adjusted close → monthly total-return series แล้ว cache ถาวร (SQLite local / KV บน Vercel) | ข้อมูลเดือนเก่าไม่เปลี่ยน — cache ครั้งเดียวใช้ตลอด ลดทั้ง latency และโควตา API |
| 0.4 | Engine core + golden tests | `portfolioReturns()`, `growth()`, `cagr()`, `stdev()`, `maxDrawdown()`, `sharpe()`, `sortino()` เป็น pure function + vitest เทียบ golden fixture (ภาคผนวก A) | ความน่าเชื่อถือของเลขคือชีวิตของ tool นี้ — fixture จากต้นแบบพิสูจน์ว่าเราคำนวณตรงมาตรฐานอุตสาหกรรม |

**Success criteria:** `npm test` ผ่านโดย metric หลักตรง golden fixture (±0.1% จากผลต้นแบบ), preview deploy ขึ้น Vercel

### Phase 1 — MVP Backtest (~2–3 สัปดาห์) 🎯 จุด demo แรก

เป้าหมาย: พอร์ตเดียว + benchmark → หน้า results ที่สวยพอส่งให้ recruiter ดูได้ทันที

| # | Feature | What | Why |
|---|---|---|---|
| 1.1 | Portfolio config form | ticker autocomplete + weight (รวม 100%), เงินตั้งต้น, ช่วงเวลา (ปี), benchmark 1 ตัว | ประตูเข้า tool — ต้อง friction ต่ำ: ผิดตรงไหนบอกตรงนั้น, มีตัวอย่างพอร์ตให้กดใช้เลย |
| 1.2 | Backtest run + Summary metrics | CAGR, Stdev, Best/Worst Year, Max Drawdown, Sharpe, Sortino, End Balance — เทียบ benchmark ทุกตัว | ชุดนี้คือคำถามแรกของทุกคน: "ได้เท่าไหร่ เสี่ยงแค่ไหน แพ้/ชนะตลาดไหม" = 80% ของคุณค่าต้นแบบ |
| 1.3 | Portfolio Growth chart | เส้นมูลค่าพอร์ต vs benchmark, toggle log scale | ภาพเดียวที่คนจำได้จาก backtest — เป็นภาพหลักของ demo และ screenshot ใน case study |
| 1.4 | Annual Returns chart + table | แท่งผลตอบแทนรายปี พอร์ต vs benchmark | ตอบ "ปีแย่ ๆ เจ็บแค่ไหน" แบบที่ CAGR ซ่อนไว้ — สำคัญต่อการตัดสินใจถือจริง |
| 1.5 | Drawdown chart + worst-5 table | กราฟ underwater + ตาราง drawdown ลึกสุด (ช่วง, ความลึก, เวลาฟื้น) | ความเสี่ยงที่คนรู้สึกจริงไม่ใช่ stdev แต่คือ "เคยติดลบสุดเท่าไหร่ นานแค่ไหนกว่าจะฟื้น" |
| 1.6 | Demo portfolios + landing | พอร์ตตัวอย่าง 3 แบบ (เช่น 60/40, All-US, Global) กดแล้วเห็นผลทันที + หน้า landing สั้น ๆ | recruiter มีเวลา 30 วินาที — ต้องเห็นของโดยไม่ต้องคิด ticker เอง |
| 1.7 | Deploy production + README กรณีศึกษา | Vercel production + README เล่า architecture/decisions | ตัว project กลายเป็นหลักฐานสมัครงานตั้งแต่ phase แรก ไม่ต้องรอจบ |

**Success criteria:** URL public ใช้งานได้จริง end-to-end (พิมพ์ VTI/BND → เห็นครบ 1.2–1.5 ใน <5 วินาที), เลขตรง golden fixture, ใช้บนมือถือได้

> **ลำดับที่ใช้จริง (PD-011):** หลังปิดเฟส 1 พบว่าหุ้นไทยใช้ได้แล้วผ่านแหล่งข้อมูลปัจจุบัน และอัตรา
> แลกเปลี่ยนอยู่บนแหล่งเดียวกัน จึง**ยกเฟส 3 ขึ้นมาทำก่อนเฟส 2** และเรียงภายในเฟส 3 ใหม่เป็น
> สกุลเงิน + หุ้นไทย (S9–S11) → spike กองทุนไทยและเงินเฟ้อ (S12) → ส่วนที่เหลือ (S13)
> แล้วค่อยกลับมาทำเฟส 2 ที่ S14–S16 · เนื้อหาของแต่ละเฟสด้านล่างไม่เปลี่ยน เปลี่ยนแค่ลำดับ

### Phase 2 — Compare & Cashflows (~2 สัปดาห์)

เป้าหมาย: จาก "เครื่องคิดเลขพอร์ตเดียว" → เครื่องมือเปรียบเทียบและจำลองพฤติกรรมลงทุนจริง

| # | Feature | What | Why |
|---|---|---|---|
| 2.1 | เทียบ ≤3 พอร์ต | ฟอร์มหลายพอร์ต + ทุก chart/table แสดงซ้อนกัน | คำถามจริงของนักลงทุนคือเชิงเปรียบเทียบ ("เพิ่ม gold 10% ดีไหม") — และเข้ากับทักษะ two-variant validation ที่เจ้าของใช้ในงาน PO |
| 2.2 | Cashflows (DCA/ถอน) | เงินเข้า-ออกคงที่รายเดือน/ปี (+ปรับตามเงินเฟ้อ), ถอนเป็น % | คนไทยส่วนใหญ่ DCA ไม่ใช่ lump sum — ไม่มีข้อนี้ = จำลองพฤติกรรมจริงไม่ได้เลย |
| 2.3 | Rebalancing options | none / รายปี / รายไตรมาส / รายเดือน / bands (±x%) | คำถามคลาสสิกที่ spreadsheet ตอบยากมาก แต่ engine ตอบได้ฟรี — effort ต่ำ คุณค่าสูง |
| 2.4 | Rolling Returns | ตาราง avg/high/low + chart รายหน้าต่าง 1/3/5/10 ปี | ฆ่า start-date bias — แสดงว่าผลลัพธ์ขึ้นกับจังหวะเข้าแค่ไหน (จุดที่มือใหม่พลาดบ่อยสุด) |
| 2.5 | Monthly returns table + CSV export | ตารางรายเดือนทุกพอร์ต + ปุ่ม export CSV | ทางออกสำหรับ power user ที่อยากวิเคราะห์ต่อเอง — กัน feature request ยิบย่อยไหลเข้า |
| 2.6 | Shareable link | state ทั้งหมดอยู่ใน URL (encode config) | ส่งผล backtest ให้เพื่อน/ใส่ในใบสมัครได้ 1 คลิก — และได้ deep-link demo ฟรี |

**Success criteria:** ลิงก์ที่แชร์เปิดซ้ำแล้วได้ผลเหมือนเดิม 100%, ผล DCA + rebalance ตรวจทานกับการคำนวณมือ 1 กรณี

**สถานะ:** spec ครบทั้งเฟสแล้วที่ S14 — epic `compare-cashflows` + US-16 ถึง US-22 เป็น 🟢 Ready
· สองการตัดสินใจที่กำหนดรูปร่างของเฟสนี้คือ [PD-014](../docs/product/decision-log.md) (ค่าไหนร่วมกัน
ค่าไหนแยกรายพอร์ต) และ [PD-015](../docs/product/decision-log.md) (เมื่อมีเงินเข้าออก ต้องแสดง
ผลตอบแทนสองค่าพร้อมป้ายกำกับ เพราะแสดงค่าเดียวทำให้ผู้ใช้อ่านผิดแล้วตัดสินใจลงทุนผิด)
· ลงมือที่ S15 (2.1) · S15b (2.2–2.3) · S16 (2.4–2.6)

### Phase 3 — Thai Market (~2–3 สัปดาห์) 🇹🇭 จุดขายหลัก

เป้าหมาย: สิ่งที่ Portfolio Visualizer ทำไม่ได้ — backtest พอร์ตแบบที่คนไทยถือจริง

| # | Feature | What | Why |
|---|---|---|---|
| 3.0 | **Spike (ทำก่อน commit เฟสนี้):** สำรวจ SEC Open Data API | ตรวจความลึก NAV ย้อนหลัง, rate limit, การ map ชื่อกองทุน → รายงานสั้น ๆ ก่อนตัดสินใจ scope | ถ้าข้อมูลย้อนหลังตื้นหรือ API ไม่เสถียร ต้องรู้ก่อนลงแรง — ผลของ spike อาจปรับ 3.1 เป็น "นำเข้าไฟล์ NAV เอง" |
| 3.1 | กองทุนรวมไทย | ค้นหากองทุนไทย + ดึง NAV เป็น monthly series ผ่าน `SecThFundProvider` | หัวใจของจุดขาย — เปิดตลาดผู้ใช้ที่ต้นแบบไม่ตอบโจทย์ และตรงพอร์ตจริงของเจ้าของ · **⏸ พักไว้ตาม PD-012** — ข้อมูลมีที่เดียวคือ ก.ล.ต. ซึ่งต้องมีคีย์ที่สมัครได้จากในประเทศ กลับมาทำได้เมื่อมีคีย์ |
| 3.2 | หุ้น SET | เพิ่ม provider หุ้นไทย (แหล่งตาม spike; อย่างน้อยหุ้น SET50 หลัก ๆ) | เติมภาพพอร์ตไทยให้ครบ — แต่ยอมเริ่มจาก subset เพื่อไม่ให้ data quality ฉุดทั้งเฟส · **✅ S11** (US-14) — หุ้นไทยใช้ได้ผ่านแหล่งเดิม ไม่ต้องเพิ่ม provider ใหม่ |
| 3.3 | Multi-currency (THB/USD) | เลือก base currency ของพอร์ต; แปลงทุก series ด้วย FX รายเดือนจาก Bank of Thailand API | จุดที่คนคำนวณเองผิดบ่อยสุด (ลืมว่ากำไร US ETF ส่วนหนึ่งคือค่าเงิน) — ทำถูกที่ engine ที่เดียว ทุก metric ถูกหมด · **✅ S10–S11** (US-12, US-13) — FX มาจากแหล่งเดิม (`THB=X`) และแปลงที่ชั้นข้อมูล |
| 3.4 | Real returns (เงินเฟ้อไทย) | toggle "ปรับเงินเฟ้อ" ด้วย CPI ไทย (BOT) — ต้นแบบใช้ CPI สหรัฐเท่านั้น | เป้าหมายการลงทุนจริงคืออำนาจซื้อ ไม่ใช่ตัวเลข nominal — และเป็น differentiator ที่เล่าง่ายมาก · **✅ S13** (US-15) — ดัชนีที่ดึงได้เป็น**รายปี** จึงปรับเฉพาะค่าระดับปีขึ้นไป (PD-012) |

**Success criteria:** backtest พอร์ตผสมจริง (เช่น กองทุนไทย 50% + VTI 50%, base THB) แล้วมูลค่าปลายทางตรวจทานกับคำนวณมือได้, spike report ถูกบันทึกใน `docs/`

**สถานะจริงเมื่อจบ S13:** ✅ ปิดเฟสเท่าที่แหล่งข้อมูลเปิดให้ทำ — 3.2/3.3/3.4 เสร็จและตรวจทานกับ
การคำนวณมือได้ทั้งหมด · เกณฑ์ความสำเร็จผ่านด้วยพอร์ตผสม **หุ้นไทย + VTI ฐานบาท** แทนกองทุนไทย
ที่ยังพักอยู่ · 3.1 เหลือเงื่อนไขเดียวคือคีย์ของ ก.ล.ต. (ไม่ต้อง spike ซ้ำ)

### Phase 4 — Risk Analytics เชิงลึก (~2 สัปดาห์)

เป้าหมาย: จาก "เครื่องคิดเลข" → "เครื่องมือวิเคราะห์" ระดับที่ใช้แทน Portfolio Visualizer ได้ในงานประจำวัน

| # | Feature | What | Why |
|---|---|---|---|
| 4.1 | Correlation matrix | ตาราง correlation รายเดือนของทุก asset + benchmark | หัวใจของ diversification — เห็นทันทีว่า asset ไหน "ซ้ำกัน" ไม่ได้ช่วยกระจายจริง |
| 4.2 | Return / Risk decomposition | แต่ละ asset สร้างกำไรกี่บาท และกินสัดส่วนความผันผวนกี่ % | เปิดโปง asset ที่ "น้ำหนักน้อยแต่เสี่ยงเยอะ" — มุมที่มองไม่เห็นจาก weight เฉย ๆ |
| 4.3 | Risk metrics เต็มชุด | Beta/Alpha/R², VaR/CVaR (5%), Up/Down capture, Calmar, Skew/Kurtosis, Tracking Error, Information Ratio | ครบชุดเทียบต้นแบบ — และแต่ละตัวเจ้าของอธิบายที่มาทาง finance ได้จากพื้น Econ/Corporate Finance = เนื้อเรื่อง case study |
| 4.4 | Historical stress periods | ตาราง drawdown เฉพาะช่วงวิกฤต (COVID 2020, เงินเฟ้อ 2022, ต้มยำกุ้ง 1997 สำหรับ asset ไทยที่ข้อมูลถึง) | "พอร์ตนี้รอดวิกฤตไหนมาบ้าง" คือคำถามที่ทำให้คนเชื่อผล backtest — เวอร์ชันไทยมีวิกฤตของตัวเองให้เล่า |
| 4.5 | Safe Withdrawal Rate | SWR/PWR จาก historical series ของพอร์ต | สะพานไปสาย FIRE/วางแผนเกษียณ — use case ปลายทางของการ backtest และแตกต่างเมื่อคิดเป็น THB |

**Success criteria:** ทุก metric มี unit test + tooltip อธิบายภาษาไทยสั้น ๆ ประกบ, ค่าที่เทียบกับต้นแบบได้ตรงใน ±0.1%

### Phase 5 — AI Layer + Case Study (~1–2 สัปดาห์) 🤖 มัด narrative

เป้าหมาย: เปลี่ยนจาก clone เป็น AI-native product และผลิตหลักฐานการสมัครงานเป็น output ของเฟสเอง

| # | Feature | What | Why |
|---|---|---|---|
| 5.1 | AI Portfolio Commentary | Claude API สรุปผล backtest เป็นภาษาไทย: จุดแข็ง/จุดเสี่ยง, อธิบาย drawdown ใหญ่ว่าเกิดช่วงไหนเพราะบริบทอะไร | แก้ปัญหา "ตาราง metric อ่านไม่ออก" ของต้นแบบ — และเป็นหลักฐาน AI Builder ที่จับต้องได้ที่สุดใน project |
| 5.2 | Natural-language portfolio input | พิมพ์ "60/40 หุ้นโลก/พันธบัตร DCA เดือนละหมื่น" → แปลงเป็น config พร้อมให้ยืนยันก่อนรัน | ลด friction การตั้งพอร์ตเหลือประโยคเดียว — โชว์ structured-output engineering ไม่ใช่แค่เรียก LLM |
| 5.3 | Playwright E2E + evidence | E2E ครอบ flow หลัก + วิดีโอ/รายงาน HTML เป็นหลักฐาน release | reuse pattern เดียวกับ evidence harness ในเรซูเม่ — เชื่อมผลงานเก่า-ใหม่เป็นเส้นเดียว |
| 5.4 | Case-study writeup | เอกสารเล่า problem → architecture → AI workflow ที่ใช้สร้าง → ผลลัพธ์ (ผนวกเข้า portfolio ใบสมัคร FlowAccount) | เป้าหมายครึ่งหนึ่งของ project — เขียนตอนของสดใหม่ ไม่ใช่ย้อนเขียนทีหลัง |

**Success criteria:** commentary ไม่ hallucinate ตัวเลข (ตัวเลขทุกตัวใน prompt มาจาก engine เท่านั้น), case study 1 หน้าอ่านจบแล้วเข้าใจทั้ง product และวิธีสร้าง

---

## 5. Cross-cutting (ทำต่อเนื่องทุกเฟส)

- **ความถูกต้องของเลขมาก่อนเสมอ** — ทุก metric ใหม่ต้องมี unit test; metric ที่ต้นแบบมีให้เทียบ ต้องเทียบ
- **i18n ไทย/อังกฤษ** — โครงสร้างรองรับตั้งแต่แรก (UI หลักภาษาไทย, สลับอังกฤษได้เพื่อผู้ชมต่างชาติตอน demo)
- **Responsive + dark mode** — ใช้ demo จากมือถือได้ (recruiter เปิดจากแชทบ่อยกว่า desktop)
- **Disclaimer** — ทุกหน้า results มีข้อความ "ผลในอดีตไม่การันตีอนาคต / ไม่ใช่คำแนะนำการลงทุน" — จำเป็นทั้งเชิงจรรยาบรรณและกันความเข้าใจผิดเมื่อ deploy public

## 6. ตัดออกอย่างตั้งใจ (Later / Never)

| รายการ | เหตุผล |
|---|---|
| Monte Carlo simulation | ต้นแบบแยกเป็นอีก tool — เป็น project ภาคต่อที่ดี แต่ไม่ใช่แกนของ backtest |
| Factor regression (Fama-French) | ผู้ชมหลัก (นักลงทุนทั่วไป + recruiter) ไม่ได้ใช้ — effort สูง คุณค่าแคบ |
| Holdings-based style analysis | ต้องใช้ข้อมูล Morningstar ซึ่งเป็น licensed data — ทำไม่ได้แบบ free/open |
| Auth + บันทึกพอร์ตบน server | localStorage + shareable URL ครอบคลุม use case แล้ว; auth เพิ่ม attack surface โดยไม่เพิ่มคุณค่า demo |
| Portfolio optimization (efficient frontier) | สวยแต่เกิน scope — ถ้าทำจะเป็น Phase 6+ หลังของหลักนิ่งแล้ว |

## 7. Risk register

| ความเสี่ยง | ผลกระทบ | แผนรับมือ |
|---|---|---|
| Free price API (Stooq/Yahoo) เปลี่ยน format / โดน block | ดึงราคาไม่ได้ทั้งระบบ | Adapter pattern + fallback 2 แหล่ง + cache ถาวรของ monthly series (ข้อมูลเก่าไม่ต้องดึงซ้ำเลย) |
| SEC Open Data API ให้ NAV ย้อนหลังตื้น / ไม่เสถียร | จุดขาย Phase 3 หาย | Spike 3.0 ก่อน commit; แผนสำรอง = ให้ผู้ใช้นำเข้าไฟล์ NAV (CSV) เอง |
| เลขคำนวณผิด (นิยาม metric คลาดเคลื่อน) | ความน่าเชื่อถือพังทั้ง tool | Golden fixtures จากต้นแบบ (ภาคผนวก A) + unit test ทุก metric + ระบุนิยาม (เช่น annualize จาก monthly) ใน tooltip |
| Scope creep ไล่ clone ต้นแบบทั้งหน้า | MVP ไม่จบ ไม่มีของ demo | ข้อ 6 คือสัญญา — feature ใหม่ต้องผ่านคำถาม "ช่วย demo หรือช่วยใช้จริงไหม" ก่อนเข้า backlog |
| เวลา part-time ชนกับงานประจำ | ลากยาวจนเสีย momentum | จุดตัดที่มีของครบคือจบ Phase 1 — ทุก phase หลังจากนั้น optional ต่อเป้า "ใช้ demo ได้" |

---

## 8. วิธีทำงาน (story-first, ทีละ session)

Roadmap นี้ถูกลงมือทำด้วย practice **story-first** เดียวกับที่ใช้กับ UOMS แต่ขยายให้ครอบถึงการเขียนโค้ดจริง
เพราะโปรเจกต์นี้ไม่มีทีม dev รับช่วงต่อ — คนเขียน spec กับคนเขียนโค้ดคือคนเดียวกัน

**หลักสามข้อ:**

1. **Spec มาก่อนโค้ด และ spec ผูกกับ route จริง** — ไม่มีโฟลเดอร์ prototype แยก (PD-002) ทุก story card
   ระบุ route + params ที่ใช้สาธิต และเลือกโหมดข้อมูลได้ระหว่าง `stub` (ข้อมูลจำลอง offline ผ่านสัญญา
   `PriceProvider` เดียวกับของจริง) หรือ `live` เมื่อ spec กับ route ไม่ตรงกัน ต้องตัดสินว่าฝั่งไหนถูก
   แล้วแก้อีกฝั่งในรอบเดียวกัน ห้ามปล่อยให้ต่างกัน
2. **ประตูออกคือหลักฐาน ไม่ใช่ความรู้สึกว่าเสร็จ** — การ์ดขึ้น `✅ Done` ได้ต่อเมื่อ lint + tsc + vitest
   (รวม golden tests) เขียว, เดิน route จริงกดปุ่มครบทุกปุ่มที่การ์ดพูดถึงพร้อม screenshot,
   ระบุข้อจำกัดของข้อมูลจำลองครบ และมี Change Log
3. **สิ่งที่ ship แล้วห้ามแก้ย้อนหลัง** — การ์ด `✅ Done` คือบันทึกว่าตอนนั้นผู้ใช้ทำอะไรได้จริง
   ต้องการเปลี่ยนกฎ = story ใหม่ + บันทึกการตัดสินใจ (PD)

**เอกสารประกอบ:** แผนรายรอบทั้ง 21 session อยู่ที่ [SESSION-PLAN.md](SESSION-PLAN.md) ·
การตัดสินใจที่มีผลอยู่ที่ [product/decision-log.md](product/decision-log.md) ·
คู่มือปฏิบัติการฉบับเต็ม (สองโหมด: เขียน spec / ลงมือ implement) เป็นเครื่องมือส่วนตัวใน
`.claude/skills/write-story-epic/` ซึ่งไม่ถูก commit ขึ้น repo

**ภาพรวม session:**

| กลุ่ม | Session | ได้อะไร |
| --- | --- | --- |
| A — แกนบังคับ | S0–S8 | วางโครง → spec เฟส 0–1 → ท่อข้อมูล → engine → จอ → **deploy ใช้งานจริง 🎯** |
| B — ขยาย | S9–S14 | เทียบพอร์ต + DCA + ลิงก์แชร์ → spike ตลาดไทย → กองทุนไทย/SET → สกุลเงิน+เงินเฟ้อ |
| C — เชิงลึก + AI | S15–S20 | risk analytics เต็มชุด → AI commentary → E2E evidence + case study |

S0–S8 จบแล้วมีของ demo ครบในตัว — กลุ่ม B และ C ตัด เลื่อน หรือสลับลำดับได้โดยไม่ทำให้ของก่อนหน้าพัง

---

## ภาคผนวก A — Golden fixture (เก็บจาก Portfolio Visualizer, 2026-07-28)

พอร์ต: **VTI 48% / VNQ 8% / VXUS 24% / BND 20%**, เงินตั้งต้น $10,000, Jan 2012 – Jun 2026,
rebalance รายปี, benchmark = SPY (State Street SPDR S&P 500 ETF)

| Metric | Portfolio | Benchmark (SPY) |
|---|---|---|
| End Balance | $41,515 | $76,655 |
| CAGR | 10.32% | 15.08% |
| Stdev (annualized) | 11.43% | 14.03% |
| Best Year | 24.02% (2019) | 32.31% |
| Worst Year | −17.95% (2022) | −18.17% |
| Max Drawdown | −23.55% (Jan–Sep 2022, ฟื้น 18 เดือน) | −23.93% |
| Sharpe Ratio | 0.78 | 0.96 |
| Sortino Ratio | 1.18 | 1.55 |
| Beta / Alpha / R² | 0.79 / −1.36% / 93.11% | 1.00 / 0.00% / 100% |
| VaR 5% (hist. / analytical / CVaR, monthly) | 5.24% / 4.55% / 7.04% | 6.04% / 5.40% / 8.31% |
| Upside / Downside capture | 72.19% / 85.27% | 100% / 100% |
| Correlation matrix (ย่อ) | VTI–VXUS 0.83, VTI–BND 0.36, VNQ–BND 0.60 | — |

**ช่วงขาดทุนลึกสุด 5 อันดับของพอร์ต (freeze จากต้นแบบ — ใช้ตรวจ AC-ENG-11 / AC-DDW-03):**

| อันดับ | เริ่มตก | ต่ำสุด | ความลึก | ฟื้นเมื่อ | เวลาฟื้น |
|---|---|---|---|---|---|
| 1 | ม.ค. 2022 | ก.ย. 2022 | −23.55% | มี.ค. 2024 | 1 ปี 6 เดือน |
| 2 | ม.ค. 2020 | มี.ค. 2020 | −17.36% | **ก.ค. 2020** ⚠ | **4 เดือน** ⚠ |
| 3 | ก.ย. 2018 | ธ.ค. 2018 | −10.18% | เม.ย. 2019 | 4 เดือน |
| 4 | มิ.ย. 2015 | ก.พ. 2016 | −8.49% | ก.ค. 2016 | 5 เดือน |
| 5 | เม.ย. 2012 | พ.ค. 2012 | −6.23% | ส.ค. 2012 | 3 เดือน |

⚠ **แถวที่ 2 ต่างจากต้นแบบหนึ่งเดือน (PD-007):** Portfolio Visualizer ระบุว่าฟื้น ส.ค. 2020 (5 เดือน)
แต่ข้อมูลที่เรา freeze ไว้ทำให้พอร์ตกลับขึ้นเหนือจุดสูงสุดเดิมตั้งแต่ ก.ค. 2020 — โดยเกินไปเพียง **0.0034%**
ซึ่งเป็นระยะที่ข้อมูลราคาต่างผู้ให้บริการกันเพียงเล็กน้อยก็พลิกผลได้ ความลึก เดือนเริ่มตก และเดือนต่ำสุด
ตรงกับต้นแบบทุกค่า ตารางนี้จึงยึดค่าที่คำนวณจากข้อมูลของเราเองเป็นเกณฑ์ทดสอบ

ใช้เป็น input ของ unit tests ใน Phase 0.4 — ถ้า engine คำนวณชุดนี้ตรง (±0.1%) ถือว่านิยาม metric ถูกต้อง
(ต้องดึง monthly series ช่วงเดียวกันมา freeze เป็น fixture ด้วย เพื่อไม่ให้ผล test ขึ้นกับ API สด)

**อัตราปราศจากความเสี่ยง (PD-004):** Sharpe/Sortino ของต้นแบบคำนวณด้วยอัตรา T-Bill 3 เดือนสหรัฐ
ที่เปลี่ยนตามเวลา — ค่าคงที่ตัวเดียว fit ทั้ง Sharpe 0.78 + Sortino 1.18 + ค่าฝั่ง SPY พร้อมกันไม่ได้
fixture จึงต้องรวม **ชุด rf รายเดือน (T-Bill 3 เดือน, ม.ค. 2012 – มิ.ย. 2026) ที่ freeze ไว้** เป็นอีกหนึ่ง
series พร้อมบันทึกที่มา — ยังคงทดสอบแบบ offline ทั้งหมด การใช้ rf สดเป็นเรื่องของเฟส 4
