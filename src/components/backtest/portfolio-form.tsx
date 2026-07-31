"use client"

import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ComboboxField, type ComboboxItemGroup } from "@/components/backtest/combobox-field"
import {
  FULL_HISTORY_SINCE,
  SYMBOL_GROUPS,
  findSymbol,
} from "@/lib/backtest/suggested-symbols"
import {
  evenWeights,
  portfolioIssuesAt,
  weightSum,
  type FormIssues,
  type ValidationIssue,
} from "@/lib/backtest/validation"
import { emptyPortfolio, emptyRow } from "@/lib/backtest/url"
import { resolvePortfolioNames } from "@/lib/backtest/portfolio-names"
import {
  CASHFLOW_FREQUENCY_OPTIONS,
  CURRENCY_OPTIONS,
  DEFAULT_BAND_POINTS,
  defaultCashflow,
  MAX_ASSETS,
  MAX_PORTFOLIOS,
  MAX_PORTFOLIO_NAME,
  MIN_ASSETS,
  MIN_PORTFOLIOS,
  REBALANCE_OPTIONS,
  type BacktestConfig,
  type CashflowSpec,
  type PortfolioRow,
  type PortfolioSpec,
} from "@/types/backtest"
import {
  plannedTotal,
  type CashflowAllocation,
  type CashflowBasis,
  type CashflowDirection,
  type CashflowFrequency,
  type RebalanceMode,
} from "@/engine"
import { formatMoney } from "@/lib/backtest/format"
import cpiFixture from "@/data/fixtures/th-cpi.json"
import type { Currency } from "@/data/currency"
import { toYearMonth, type MonthlyReturn } from "@/types/series"
import { useLanguage } from "@/i18n"

const MESSAGE_KEY: Record<string, string> = {
  "V-001": "validation.weightSum",
  "V-002": "validation.assetRequired",
  "V-003": "validation.symbolUnknown",
  "V-004": "validation.rangeOrder",
  "V-005": "validation.rangeFuture",
  "V-006": "validation.amountPositive",
  "V-007": "validation.weightRange",
  "V-008": "validation.linkInvalid",
  "V-010": "validation.symbolDuplicate",
  "V-011": "validation.cashflowAmount",
  "V-012": "validation.rebalanceBand",
  "V-013": "validation.portfolioNameDuplicate",
  "V-014": "validation.withdrawPercent",
}

/** ป้ายของแต่ละวิธีปรับสมดุล เขียนไว้ที่เดียวเพื่อให้ตัวตรวจชนิดข้อมูลบังคับว่าครบทั้ง 5 แบบ */
const REBALANCE_LABEL: Record<RebalanceMode, string> = {
  none: "form.rebalanceNone",
  monthly: "form.rebalanceMonthly",
  quarterly: "form.rebalanceQuarterly",
  annual: "form.rebalanceAnnual",
  bands: "form.rebalanceBands",
}

const CASHFLOW_FREQUENCY_LABEL: Record<CashflowFrequency, string> = {
  monthly: "form.cashflowMonthly",
  quarterly: "form.cashflowQuarterly",
  annual: "form.cashflowAnnual",
}

/** น้ำหนักเป้าหมายที่ยกเป็นตัวอย่างในคำอธิบายเกณฑ์การเบี่ยงเบน (BR-CMP-56) */
const BAND_EXAMPLE_WEIGHT = 60

/** ดัชนีเงินเฟ้อไทยชุดเดียวกับที่ชั้นคำนวณใช้ — ยอดรวมที่แสดงจึงตรงกับที่จะได้จริง */
const INFLATION_RATES = cpiFixture.rates

export function issueMessage(
  issue: ValidationIssue | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  if (!issue) return null
  return t(MESSAGE_KEY[issue.code] ?? issue.code, issue.params)
}

type Props = {
  config: BacktestConfig
  issues: FormIssues
  checkingSymbols: boolean
  submitting: boolean
  lastClosedYear: number
  onChange: (next: BacktestConfig) => void
  onSubmit: () => void
  onSymbolBlur: (symbol: string) => void
}

/** จำนวนปีย้อนหลังที่เสนอในรายการเลือกปี (พิมพ์ปีอื่นเองได้เสมอ) */
const YEAR_CHOICES = 30

export function PortfolioForm({
  config,
  issues,
  checkingSymbols,
  submitting,
  lastClosedYear,
  onChange,
  onSubmit,
  onSymbolBlur,
}: Props) {
  const { t } = useLanguage()

  /** หมวดพร้อมหัวข้อสำหรับกล่องที่กางลงมา (BR-CAT-15) */
  const symbolGroups: ComboboxItemGroup[] = SYMBOL_GROUPS.map((group) => ({
    label: t(group.labelKey),
    items: group.symbols.map((item) => item.symbol),
  }))

  /**
   * คำอธิบายใต้แต่ละตัวเลือก — ชื่อสินทรัพย์ และปีที่ข้อมูลเริ่มเมื่อเริ่มช้ากว่าชุดอ้างอิง
   *
   * กำกับปีเฉพาะตัวที่เริ่มหลัง `FULL_HISTORY_SINCE` เท่านั้น (BR-CAT-04) เพราะถ้าใส่ทุกตัว
   * มันจะกลายเป็นสัญญาณรบกวนจนคนไม่อ่าน — สิ่งที่ต้องสะดุดตาคือตัวที่จะย่อช่วงเวลาให้สั้นลง
   */
  const describeSymbol = (symbol: string) => {
    const match = findSymbol(symbol)
    if (!match) return undefined
    const name = t(match.labelKey)
    return match.since > FULL_HISTORY_SINCE
      ? `${name} · ${t("form.symbolSince", { year: match.since })}`
      : name
  }
  const yearItems = Array.from({ length: YEAR_CHOICES }, (_, i) => String(lastClosedYear - i))

  const names = resolvePortfolioNames(
    config.portfolios.map((p) => p.name),
    t,
  )
  const multiple = config.portfolios.length > 1

  const updatePortfolio = (index: number, patch: Partial<PortfolioSpec>) => {
    const portfolios = config.portfolios.map((p, i) => (i === index ? { ...p, ...patch } : p))
    onChange({ ...config, portfolios })
  }

  const updateRow = (pIndex: number, index: number, patch: Partial<PortfolioRow>) => {
    const assets = config.portfolios[pIndex].assets.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    )
    updatePortfolio(pIndex, { assets })
  }

  const addPortfolio = () =>
    onChange({ ...config, portfolios: [...config.portfolios, emptyPortfolio()] })

  const removePortfolio = (index: number) =>
    onChange({ ...config, portfolios: config.portfolios.filter((_, i) => i !== index) })

  const formMessage = issueMessage(issues.form, t)

  /**
   * เดือนของช่วงที่ผู้ใช้ขอ ใช้บอกยอดรวมที่จะใส่ก่อนกดรัน (BR-CMP-51)
   * เป็นค่าประมาณโดยตั้งใจ เพราะช่วงจริงอาจสั้นกว่านี้เมื่อสินทรัพย์บางตัวมีข้อมูลไม่ครบ
   */
  const askedMonths = monthsInRange(config.startYear, config.endYear)

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      {config.portfolios.map((portfolio, pIndex) => {
        const portfolioIssues = portfolioIssuesAt(issues, pIndex)
        const portfolioMessage = issueMessage(portfolioIssues.portfolio, t)
        const total = weightSum(portfolio.assets)
        const nameId = `p${pIndex}-name`
        const errorId = `p${pIndex}-error`

        return (
          // กรอบและหัวข้อมีทุกโหมด เพื่อให้เห็นขอบเขตว่าอะไรเป็นค่าของพอร์ต (BR-FRM-10)
          <fieldset key={pIndex} className="flex flex-col gap-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">
              {multiple ? names[pIndex] : t("form.assets")}
            </legend>

            {multiple ? (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor={nameId} className="text-xs text-muted-foreground">
                    {t("form.portfolioName")}
                  </Label>
                  <Input
                    id={nameId}
                    value={portfolio.name}
                    maxLength={MAX_PORTFOLIO_NAME}
                    placeholder={names[pIndex]}
                    aria-invalid={portfolioIssues.portfolio?.code === "V-013"}
                    aria-describedby={portfolioMessage ? errorId : undefined}
                    onChange={(e) => updatePortfolio(pIndex, { name: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={t("form.removePortfolio", { name: names[pIndex] })}
                  title={
                    config.portfolios.length <= MIN_PORTFOLIOS
                      ? t("form.removePortfolioDisabled")
                      : t("form.removePortfolio", { name: names[pIndex] })
                  }
                  disabled={config.portfolios.length <= MIN_PORTFOLIOS}
                  onClick={() => removePortfolio(pIndex)}
                >
                  {t("form.removePortfolioShort")}
                </Button>
              </div>
            ) : null}

            {portfolio.assets.map((row, index) => {
              const message = issueMessage(portfolioIssues.rows[index] ?? null, t)
              const rowErrorId = `p${pIndex}-asset-error-${index}`
              return (
                <div key={index} className="flex flex-col gap-1">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label
                        htmlFor={`p${pIndex}-symbol-${index}`}
                        className="text-xs text-muted-foreground"
                      >
                        {t("form.symbol")}
                      </Label>
                      <ComboboxField
                        id={`p${pIndex}-symbol-${index}`}
                        value={row.symbol}
                        groups={symbolGroups}
                        describe={describeSymbol}
                        emptyLabel={t("form.symbolFreeText")}
                        placeholder={t("form.symbolPlaceholder")}
                        invalid={message !== null}
                        describedBy={message ? rowErrorId : undefined}
                        onValueChange={(value) => updateRow(pIndex, index, { symbol: value })}
                        onBlur={onSymbolBlur}
                      />
                    </div>
                    <div className="w-28">
                      <Label
                        htmlFor={`p${pIndex}-weight-${index}`}
                        className="text-xs text-muted-foreground"
                      >
                        {t("form.weight")}
                      </Label>
                      <Input
                        id={`p${pIndex}-weight-${index}`}
                        inputMode="decimal"
                        value={row.weight}
                        aria-invalid={message !== null}
                        aria-describedby={message ? rowErrorId : undefined}
                        onChange={(e) => updateRow(pIndex, index, { weight: e.target.value })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("form.removeRow")}
                      title={
                        portfolio.assets.length <= MIN_ASSETS
                          ? t("form.removeDisabled")
                          : t("form.removeRow")
                      }
                      disabled={portfolio.assets.length <= MIN_ASSETS}
                      onClick={() =>
                        updatePortfolio(pIndex, {
                          assets: portfolio.assets.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <X aria-hidden className="size-4" />
                    </Button>
                  </div>
                  {message ? (
                    <p id={rowErrorId} role="alert" className="text-xs text-destructive">
                      {message}
                    </p>
                  ) : null}
                </div>
              )
            })}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={portfolio.assets.length >= MAX_ASSETS}
                title={
                  portfolio.assets.length >= MAX_ASSETS ? t("form.addDisabled") : t("form.addRow")
                }
                onClick={() =>
                  updatePortfolio(pIndex, { assets: [...portfolio.assets, emptyRow()] })
                }
              >
                <Plus aria-hidden className="size-4" />
                {t("form.addRow")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const weights = evenWeights(portfolio.assets.length)
                  updatePortfolio(pIndex, {
                    assets: portfolio.assets.map((row, i) => ({ ...row, weight: weights[i] })),
                  })
                }}
              >
                {t("form.evenWeights")}
              </Button>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {t("form.weightTotal", { sum: Number.isInteger(total) ? total : total.toFixed(2) })}
              </span>
            </div>

            <RebalanceControls
              pIndex={pIndex}
              portfolio={portfolio}
              invalid={portfolioIssues.portfolio?.code === "V-012"}
              errorId={portfolioMessage ? errorId : undefined}
              onChange={(patch) => updatePortfolio(pIndex, patch)}
            />

            <CashflowControls
              pIndex={pIndex}
              portfolio={portfolio}
              currency={config.baseCurrency}
              months={askedMonths}
              invalid={
                portfolioIssues.portfolio?.code === "V-011" ||
                portfolioIssues.portfolio?.code === "V-014"
              }
              errorId={portfolioMessage ? errorId : undefined}
              onChange={(patch) => updatePortfolio(pIndex, patch)}
            />

            {portfolioMessage ? (
              <p id={errorId} role="alert" className="text-sm text-destructive">
                {portfolioMessage}
              </p>
            ) : null}
          </fieldset>
        )
      })}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={config.portfolios.length >= MAX_PORTFOLIOS}
          title={
            config.portfolios.length >= MAX_PORTFOLIOS
              ? t("form.addPortfolioDisabled", { max: MAX_PORTFOLIOS })
              : t("form.addPortfolio")
          }
          onClick={addPortfolio}
        >
          <Plus aria-hidden className="size-4" />
          {t("form.addPortfolio")}
        </Button>
      </div>

      {/*
        ค่าที่เป็นฐานของการเทียบ กรอกครั้งเดียวใช้ร่วมกันทุกพอร์ต (PD-014)
        มีกรอบและหัวข้อทุกโหมด (BR-FRM-12) · คำว่า "ทุกพอร์ต" ใช้เฉพาะตอนมีหลายพอร์ตจริง
        เพราะในโหมดพอร์ตเดียวมันอ่านแปลก (BR-FRM-13)
      */}
      <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">
          {multiple ? t("form.sharedSettings") : t("form.testSettings")}
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="amount"
            label={`${t("form.amount")} (${t(`currency.${config.baseCurrency}.unit`)})`}
            value={String(config.amount)}
            message={issueMessage(issues.amount, t)}
            inputMode="numeric"
            onChange={(value) => onChange({ ...config, amount: Number(value) })}
          />
          <ComboboxFieldRow
            id="baseCurrency"
            label={t("form.baseCurrency")}
            value={config.baseCurrency}
            items={[...CURRENCY_OPTIONS]}
            describe={(code) => t(`currency.${code}.name`)}
            emptyLabel={t("form.currencyFixed")}
            message={null}
            onChange={(value) =>
              onChange({
                ...config,
                baseCurrency: CURRENCY_OPTIONS.includes(value as never)
                  ? (value as typeof config.baseCurrency)
                  : config.baseCurrency,
              })
            }
          />
          <ComboboxFieldRow
            id="benchmark"
            label={t("form.benchmark")}
            value={config.benchmark}
            groups={symbolGroups}
            describe={describeSymbol}
            emptyLabel={t("form.symbolFreeText")}
            message={issueMessage(issues.benchmark, t)}
            onChange={(value) => onChange({ ...config, benchmark: value })}
            onBlur={onSymbolBlur}
          />
          <ComboboxFieldRow
            id="startYear"
            label={t("form.startYear")}
            value={String(config.startYear)}
            items={yearItems}
            emptyLabel={t("form.yearFreeText")}
            message={issueMessage(issues.startYear, t)}
            inputMode="numeric"
            onChange={(value) => onChange({ ...config, startYear: Number(value) })}
          />
          <ComboboxFieldRow
            id="endYear"
            label={t("form.endYear")}
            value={String(config.endYear)}
            items={yearItems}
            emptyLabel={t("form.yearFreeText")}
            message={issueMessage(issues.endYear, t)}
            inputMode="numeric"
            onChange={(value) => onChange({ ...config, endYear: Number(value) })}
          />

          {/* ช่องสุดท้ายของตาราง — อยู่แถวเดียวกับช่องอื่นบนจอกว้าง และขึ้นบรรทัดใหม่บนจอแคบ */}
          <div className="flex flex-col gap-1 sm:justify-end sm:pb-1">
            <label className="flex items-start gap-2">
              <Checkbox
                id="inflationAdjusted"
                className="mt-0.5"
                checked={config.inflationAdjusted}
                aria-describedby="inflationAdjusted-hint"
                onCheckedChange={(checked) =>
                  onChange({ ...config, inflationAdjusted: checked === true })
                }
              />
              <span className="text-xs font-medium">{t("form.inflationAdjusted")}</span>
            </label>
            <p id="inflationAdjusted-hint" className="text-xs text-pretty text-muted-foreground">
              {t("form.inflationAdjustedHint")}
            </p>
          </div>
        </div>
      </fieldset>

      {formMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {formMessage}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? t("form.submitting") : t("form.submit")}
        </Button>
        {checkingSymbols ? (
          <span className="text-xs text-muted-foreground">{t("form.checking")}</span>
        ) : null}
      </div>
    </form>
  )
}

/**
 * วิธีปรับสมดุลของพอร์ตนั้น (US-19) — ช่องเกณฑ์โผล่เฉพาะแบบเบี่ยงเบน
 * คำอธิบายแปลงเกณฑ์เป็นช่วงน้ำหนักจริงให้เห็น ไม่ใช่บอกแค่ตัวเลขจุดเปอร์เซ็นต์ (BR-CMP-56)
 */
function RebalanceControls({
  pIndex,
  portfolio,
  invalid,
  errorId,
  onChange,
}: {
  pIndex: number
  portfolio: PortfolioSpec
  invalid: boolean
  errorId?: string
  onChange: (patch: Partial<PortfolioSpec>) => void
}) {
  const { t } = useLanguage()
  const selectId = `p${pIndex}-rebalance`
  const bandId = `p${pIndex}-band`
  const bandHintId = `${bandId}-hint`
  const points = Number(portfolio.bandPoints)
  const showBandHint = Number.isFinite(points) && portfolio.bandPoints.trim() !== ""

  return (
    // เส้นคั่นแบบเดียวกับบล็อกเงินเข้าออก ทำให้เห็นสามชั้นในการ์ด (BR-FRM-11)
    <div className="flex flex-col gap-1 border-t pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={selectId} className="text-xs text-muted-foreground">
            {t("form.rebalance")}
          </Label>
          <SelectInput
            id={selectId}
            value={portfolio.rebalance}
            onChange={(value) =>
              onChange({
                rebalance: value as RebalanceMode,
                // เพิ่งเปลี่ยนมาเป็นแบบเบี่ยงเบนแล้วยังไม่เคยกรอก ให้เริ่มที่ค่าปริยาย (BR-CMP-57)
                bandPoints:
                  value === "bands" && portfolio.bandPoints.trim() === ""
                    ? DEFAULT_BAND_POINTS
                    : portfolio.bandPoints,
              })
            }
          >
            {REBALANCE_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {t(REBALANCE_LABEL[mode])}
              </option>
            ))}
          </SelectInput>
        </div>

        {portfolio.rebalance === "bands" ? (
          <div className="flex w-full flex-col gap-1 sm:w-44">
            <Label htmlFor={bandId} className="text-xs text-muted-foreground">
              {t("form.bandPoints")}
            </Label>
            <Input
              id={bandId}
              inputMode="decimal"
              value={portfolio.bandPoints}
              aria-invalid={invalid}
              aria-describedby={[showBandHint ? bandHintId : null, invalid ? errorId : null]
                .filter(Boolean)
                .join(" ") || undefined}
              onChange={(e) => onChange({ bandPoints: e.target.value })}
            />
          </div>
        ) : null}
      </div>

      {portfolio.rebalance === "bands" && showBandHint ? (
        <p id={bandHintId} className="text-xs text-pretty text-muted-foreground">
          {t("form.bandPointsHint", {
            points: portfolio.bandPoints.trim(),
            low: BAND_EXAMPLE_WEIGHT - points,
            high: BAND_EXAMPLE_WEIGHT + points,
          })}
        </p>
      ) : null}

      {/* ข้อจำกัดที่ทำให้ผลดูดีกว่าความจริง ต้องบอกไว้ตรงที่ผู้ใช้เลือก (BR-CMP-58) */}
      {portfolio.rebalance !== "none" ? (
        <p className="text-xs text-pretty text-muted-foreground">{t("form.rebalanceNoFees")}</p>
      ) : null}
    </div>
  )
}

/**
 * เงินเข้าออกระหว่างทางของพอร์ตนั้น (US-18) — ปิดอยู่เป็นค่าเริ่มต้น
 * ช่องที่เหลือโผล่เฉพาะตอนเปิด เพื่อไม่ให้ฟอร์มยาวเกินไปเมื่อเทียบครบสามพอร์ต
 */
function CashflowControls({
  pIndex,
  portfolio,
  currency,
  months,
  invalid,
  errorId,
  onChange,
}: {
  pIndex: number
  portfolio: PortfolioSpec
  currency: Currency
  months: MonthlyReturn[]
  invalid: boolean
  errorId?: string
  onChange: (patch: Partial<PortfolioSpec>) => void
}) {
  const { t } = useLanguage()
  const cashflow = portfolio.cashflow
  const toggleId = `p${pIndex}-cashflow`
  const amountId = `p${pIndex}-cashflow-amount`
  const allocationId = `p${pIndex}-cashflow-allocation`
  const allocationHintId = `${allocationId}-hint`
  const totalId = `p${pIndex}-cashflow-total`

  const update = (patch: Partial<CashflowSpec>) =>
    onChange({ cashflow: cashflow ? { ...cashflow, ...patch } : null })

  const planned =
    cashflow && Number.isFinite(Number(cashflow.amount)) && cashflow.amount.trim() !== ""
      ? plannedTotal(
          {
            direction: cashflow.direction,
            amount: Number(cashflow.amount),
            basis: cashflow.basis,
            frequency: cashflow.frequency,
            inflationAdjusted: cashflow.inflationAdjusted,
            allocation: cashflow.allocation,
          },
          months,
          INFLATION_RATES,
        )
      : null

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <label className="flex items-center gap-2">
        <Checkbox
          id={toggleId}
          checked={cashflow !== null}
          onCheckedChange={(checked) =>
            onChange({ cashflow: checked === true ? defaultCashflow() : null })
          }
        />
        <span className="text-xs font-medium">{t("form.cashflowEnable")}</span>
      </label>

      {cashflow ? (
        <div className="flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${toggleId}-direction`} className="text-xs text-muted-foreground">
                {t("form.cashflowDirection")}
              </Label>
              <SelectInput
                id={`${toggleId}-direction`}
                value={cashflow.direction}
                onChange={(value) =>
                  update({
                    direction: value as CashflowDirection,
                    // เปอร์เซ็นต์ตีความได้เฉพาะตอนถอน กลับมาใส่เงินจึงต้องกลับเป็นจำนวนเงิน
                    basis: value === "deposit" ? "fixed" : cashflow.basis,
                  })
                }
              >
                <option value="deposit">{t("form.cashflowDeposit")}</option>
                <option value="withdraw">{t("form.cashflowWithdraw")}</option>
              </SelectInput>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor={amountId} className="text-xs text-muted-foreground">
                {cashflow.basis === "percent"
                  ? `${t("form.cashflowAmount")} (%)`
                  : `${t("form.cashflowAmount")} (${t(`currency.${currency}.unit`)})`}
              </Label>
              <Input
                id={amountId}
                inputMode="decimal"
                value={cashflow.amount}
                aria-invalid={invalid}
                aria-describedby={invalid ? errorId : undefined}
                onChange={(e) => update({ amount: e.target.value })}
              />
            </div>

            {cashflow.direction === "withdraw" ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${toggleId}-basis`} className="text-xs text-muted-foreground">
                  {t("form.cashflowBasis")}
                </Label>
                <SelectInput
                  id={`${toggleId}-basis`}
                  value={cashflow.basis}
                  onChange={(value) => update({ basis: value as CashflowBasis })}
                >
                  <option value="fixed">{t("form.cashflowFixed")}</option>
                  <option value="percent">{t("form.cashflowPercent")}</option>
                </SelectInput>
              </div>
            ) : null}

            <div className="flex flex-col gap-1">
              <Label htmlFor={`${toggleId}-frequency`} className="text-xs text-muted-foreground">
                {t("form.cashflowFrequency")}
              </Label>
              <SelectInput
                id={`${toggleId}-frequency`}
                value={cashflow.frequency}
                onChange={(value) => update({ frequency: value as CashflowFrequency })}
              >
                {CASHFLOW_FREQUENCY_OPTIONS.map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {t(CASHFLOW_FREQUENCY_LABEL[frequency])}
                  </option>
                ))}
              </SelectInput>
            </div>

            {/* กระจายอย่างไรมีความหมายเฉพาะตอนใส่เงิน — การถอนดึงตามน้ำหนักจริงเสมอ (BR-CMP-60) */}
            {cashflow.direction === "deposit" ? (
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label htmlFor={allocationId} className="text-xs text-muted-foreground">
                  {t("form.cashflowAllocation")}
                </Label>
                <SelectInput
                  id={allocationId}
                  value={cashflow.allocation}
                  onChange={(value) => update({ allocation: value as CashflowAllocation })}
                >
                  <option value="prorata">{t("form.cashflowAllocationProrata")}</option>
                  <option value="target">{t("form.cashflowAllocationTarget")}</option>
                </SelectInput>
                {/* บอกผลที่ตามมาของทั้งสองแบบ ไม่ใช่บอกแค่ชื่อวิธี (BR-CMP-59b) */}
                <p id={allocationHintId} className="text-xs text-pretty text-muted-foreground">
                  {t("form.cashflowAllocationHint")}
                </p>
              </div>
            ) : null}
          </div>

          {/* เพิ่มตามเงินเฟ้อตีความได้เฉพาะจำนวนเงินคงที่ (BR-CMP-49) */}
          {cashflow.basis === "fixed" ? (
            <label className="flex items-center gap-2">
              <Checkbox
                id={`${toggleId}-inflation`}
                checked={cashflow.inflationAdjusted}
                onCheckedChange={(checked) => update({ inflationAdjusted: checked === true })}
              />
              <span className="text-xs">{t("form.cashflowInflation")}</span>
            </label>
          ) : null}

          <p id={totalId} className="text-xs text-muted-foreground" role="status">
            {planned && planned.total !== null
              ? t(
                  cashflow.direction === "withdraw"
                    ? "form.cashflowPlannedTotalWithdraw"
                    : "form.cashflowPlannedTotal",
                  {
                    total: formatMoney(planned.total, currency),
                    periods: planned.periods,
                  },
                )
              : t("form.cashflowPlannedUnknown")}
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** เดือนทั้งหมดของช่วงปีที่ผู้ใช้ขอ — ค่าเป็นศูนย์เพราะใช้แค่ลำดับเดือน ไม่ใช้ผลตอบแทน */
function monthsInRange(startYear: number, endYear: number): MonthlyReturn[] {
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear < startYear) return []
  const months: MonthlyReturn[] = []
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 1; month <= 12; month++) months.push({ month: toYearMonth(year, month), value: 0 })
  }
  return months
}

/**
 * รายการเลือกที่มีตัวเลือกตายตัว — ใช้ของเบราว์เซอร์เพราะเข้าถึงด้วยแป้นพิมพ์และโปรแกรมอ่าน
 * หน้าจอได้ครบโดยไม่ต้องเขียนเอง ต่างจาก ComboboxField ที่มีไว้สำหรับค่าที่พิมพ์เองได้
 */
function SelectInput({
  id,
  value,
  children,
  onChange,
}: {
  id: string
  value: string
  children: React.ReactNode
  onChange: (value: string) => void
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
    >
      {children}
    </select>
  )
}

type FieldProps = {
  id: string
  label: string
  value: string
  message: string | null
  inputMode?: "numeric" | "decimal"
  onChange: (value: string) => void
  onBlur?: (value: string) => void
}

function Field({ id, label, value, message, inputMode, onChange, onBlur }: FieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        inputMode={inputMode}
        value={value}
        aria-invalid={message !== null}
        aria-describedby={message ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur?.(e.target.value)}
      />
      {message ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  )
}

type ComboboxRowProps = FieldProps & {
  /** ส่งมาอย่างใดอย่างหนึ่ง — รายการแบน หรือรายการแบ่งหมวด */
  items?: readonly string[]
  groups?: readonly ComboboxItemGroup[]
  emptyLabel: string
  describe?: (item: string) => string | undefined
}

function ComboboxFieldRow({
  id,
  label,
  value,
  items,
  groups,
  emptyLabel,
  describe,
  message,
  inputMode,
  onChange,
  onBlur,
}: ComboboxRowProps) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <ComboboxField
        id={id}
        value={value}
        items={items}
        groups={groups}
        describe={describe}
        emptyLabel={emptyLabel}
        inputMode={inputMode}
        invalid={message !== null}
        describedBy={message ? errorId : undefined}
        onValueChange={onChange}
        onBlur={onBlur}
      />
      {message ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  )
}
