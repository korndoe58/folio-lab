"use client"

import { Plus, X } from "lucide-react"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  onChange: (next: BacktestConfig) => void
  onSubmit: () => void
  onSymbolBlur: (symbol: string) => void
}

export function PortfolioForm({
  config,
  issues,
  checkingSymbols,
  submitting,
  onChange,
  onSubmit,
  onSymbolBlur,
}: Props) {
  const { t } = useLanguage()
  const listId = useId()

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
      <datalist id={listId}>
        {SUGGESTED_SYMBOLS.map((item) => (
          <option key={item.symbol} value={item.symbol}>
            {t(item.labelKey)}
          </option>
        ))}
      </datalist>

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
                  <Input
                    id={`symbol-${index}`}
                    list={listId}
                    value={row.symbol}
                    placeholder={t("form.symbolPlaceholder")}
                    aria-invalid={message !== null}
                    aria-describedby={message ? errorId : undefined}
                    onChange={(e) => updateRow(index, { symbol: e.target.value })}
                    onBlur={(e) => onSymbolBlur(e.target.value)}
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
        <Field
          id="benchmark"
          label={t("form.benchmark")}
          value={config.benchmark}
          message={issueMessage(issues.benchmark, t)}
          listId={listId}
          onChange={(value) => onChange({ ...config, benchmark: value })}
          onBlur={onSymbolBlur}
        />
        <Field
          id="startYear"
          label={t("form.startYear")}
          value={String(config.startYear)}
          message={issueMessage(issues.startYear, t)}
          inputMode="numeric"
          onChange={(value) => onChange({ ...config, startYear: Number(value) })}
        />
        <Field
          id="endYear"
          label={t("form.endYear")}
          value={String(config.endYear)}
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
  listId?: string
  onChange: (value: string) => void
  onBlur?: (value: string) => void
}

function Field({ id, label, value, message, inputMode, listId, onChange, onBlur }: FieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        list={listId}
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
