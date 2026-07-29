"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import th from "./locales/th.json"
import en from "./locales/en.json"

export type Language = "th" | "en"

const locales: Record<Language, unknown> = { th, en }
const STORAGE_KEY = "folio-lab.lang"

type LanguageContextValue = {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function resolve(locale: unknown, key: string): string | undefined {
  let node: unknown = locale
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === "string" ? node : undefined
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("th")

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    // restore after hydration so server and first client render agree on "th"
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "th" || saved === "en") setLangState(saved)
  }, [])

  const setLang = useCallback((next: Language) => {
    setLangState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.lang = next
  }, [])

  const t = useCallback(
    (key: string) => resolve(locales[lang], key) ?? resolve(locales.th, key) ?? key,
    [lang],
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider")
  return ctx
}
