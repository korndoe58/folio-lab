"use client"

import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ComboboxField } from "@/components/backtest/combobox-field"
import { SUGGESTED_SYMBOLS, SYMBOL_GROUPS } from "@/lib/backtest/suggested-symbols"
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
  CURRENCY_OPTIONS,
  MAX_ASSETS,
  MAX_PORTFOLIOS,
  MAX_PORTFOLIO_NAME,
  MIN_ASSETS,
  MIN_PORTFOLIOS,
  type BacktestConfig,
  type PortfolioRow,
  type PortfolioSpec,
} from "@/types/backtest"
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
  "V-013": "validation.portfolioNameDuplicate",
}

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

  const symbolItems = SUGGESTED_SYMBOLS.map((item) => item.symbol)
  // คำอธิบายบอกทั้งชื่อและกลุ่ม เพื่อให้เห็นว่ามีหุ้นไทยให้เลือกด้วย (BR-SET-01)
  const describeSymbol = (symbol: string) => {
    const group = SYMBOL_GROUPS.find((g) => g.symbols.some((s) => s.symbol === symbol))
    const match = SUGGESTED_SYMBOLS.find((item) => item.symbol === symbol)
    if (match && group) return `${t(match.labelKey)} · ${t(group.labelKey)}`
    return match ? t(match.labelKey) : undefined
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
          <fieldset
            key={pIndex}
            className={multiple ? "flex flex-col gap-3 rounded-lg border p-4" : "flex flex-col gap-3"}
          >
            <legend className={multiple ? "px-1 text-sm font-medium" : "mb-2 text-sm font-medium"}>
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
                        items={symbolItems}
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

      {/* ค่าที่เป็นฐานของการเทียบ กรอกครั้งเดียวใช้ร่วมกันทุกพอร์ต (PD-014) */}
      <fieldset className="flex flex-col gap-4">
        {multiple ? (
          <legend className="mb-2 text-sm font-medium">{t("form.sharedSettings")}</legend>
        ) : null}

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
            items={symbolItems}
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
  items: readonly string[]
  emptyLabel: string
  describe?: (item: string) => string | undefined
}

function ComboboxFieldRow({
  id,
  label,
  value,
  items,
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
