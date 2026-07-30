"use client"

import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ComboboxField } from "@/components/backtest/combobox-field"
import { SUGGESTED_SYMBOLS } from "@/lib/backtest/suggested-symbols"
import { evenWeights, weightSum, type FormIssues, type ValidationIssue } from "@/lib/backtest/validation"
import { emptyRow } from "@/lib/backtest/url"
import { MAX_ASSETS, MIN_ASSETS, type BacktestConfig } from "@/types/backtest"
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
  const describeSymbol = (symbol: string) => {
    const match = SUGGESTED_SYMBOLS.find((item) => item.symbol === symbol)
    return match ? t(match.labelKey) : undefined
  }
  const yearItems = Array.from({ length: YEAR_CHOICES }, (_, i) => String(lastClosedYear - i))

  const updateRow = (index: number, patch: Partial<{ symbol: string; weight: string }>) => {
    const assets = config.assets.map((row, i) => (i === index ? { ...row, ...patch } : row))
    onChange({ ...config, assets })
  }

  const addRow = () => onChange({ ...config, assets: [...config.assets, emptyRow()] })

  const removeRow = (index: number) =>
    onChange({ ...config, assets: config.assets.filter((_, i) => i !== index) })

  const splitEvenly = () => {
    const weights = evenWeights(config.assets.length)
    onChange({ ...config, assets: config.assets.map((row, i) => ({ ...row, weight: weights[i] })) })
  }

  const formMessage = issueMessage(issues.form, t)
  const total = weightSum(config.assets)

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">{t("form.assets")}</legend>

        {config.assets.map((row, index) => {
          const message = issueMessage(issues.rows[index] ?? null, t)
          const errorId = `asset-error-${index}`
          return (
            <div key={index} className="flex flex-col gap-1">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor={`symbol-${index}`} className="text-xs text-muted-foreground">
                    {t("form.symbol")}
                  </Label>
                  <ComboboxField
                    id={`symbol-${index}`}
                    value={row.symbol}
                    items={symbolItems}
                    describe={describeSymbol}
                    emptyLabel={t("form.symbolFreeText")}
                    placeholder={t("form.symbolPlaceholder")}
                    invalid={message !== null}
                    describedBy={message ? errorId : undefined}
                    onValueChange={(value) => updateRow(index, { symbol: value })}
                    onBlur={onSymbolBlur}
                  />
                </div>
                <div className="w-28">
                  <Label htmlFor={`weight-${index}`} className="text-xs text-muted-foreground">
                    {t("form.weight")}
                  </Label>
                  <Input
                    id={`weight-${index}`}
                    inputMode="decimal"
                    value={row.weight}
                    aria-invalid={message !== null}
                    aria-describedby={message ? errorId : undefined}
                    onChange={(e) => updateRow(index, { weight: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("form.removeRow")}
                  title={
                    config.assets.length <= MIN_ASSETS ? t("form.removeDisabled") : t("form.removeRow")
                  }
                  disabled={config.assets.length <= MIN_ASSETS}
                  onClick={() => removeRow(index)}
                >
                  <X aria-hidden className="size-4" />
                </Button>
              </div>
              {message ? (
                <p id={errorId} role="alert" className="text-xs text-destructive">
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
            disabled={config.assets.length >= MAX_ASSETS}
            title={config.assets.length >= MAX_ASSETS ? t("form.addDisabled") : t("form.addRow")}
            onClick={addRow}
          >
            <Plus aria-hidden className="size-4" />
            {t("form.addRow")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={splitEvenly}>
            {t("form.evenWeights")}
          </Button>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {t("form.weightTotal", { sum: Number.isInteger(total) ? total : total.toFixed(2) })}
          </span>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="amount"
          label={`${t("form.amount")} (${t("form.amountUnit")})`}
          value={String(config.amount)}
          message={issueMessage(issues.amount, t)}
          inputMode="numeric"
          onChange={(value) => onChange({ ...config, amount: Number(value) })}
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
      </div>

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
