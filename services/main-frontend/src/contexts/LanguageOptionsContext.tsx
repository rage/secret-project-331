"use client"

import { createContext, ReactNode, useCallback, useContext, useState } from "react"

export interface LanguageOption {
  code: string
  name?: string
  isDraft?: boolean
}

interface LanguageOptionsContextValue {
  availableLanguages: LanguageOption[] | null
  setAvailableLanguages: (languages: LanguageOption[] | null) => void
  clearAvailableLanguages: () => void
}

const LanguageOptionsContext = createContext<LanguageOptionsContextValue | undefined>(undefined)

export function LanguageOptionsProvider({ children }: { children: ReactNode }) {
  const [availableLanguages, setAvailableLanguagesState] = useState<LanguageOption[] | null>(null)

  const setAvailableLanguages = useCallback((languages: LanguageOption[] | null) => {
    setAvailableLanguagesState(languages)
  }, [])

  const clearAvailableLanguages = useCallback(() => {
    setAvailableLanguagesState(null)
  }, [])

  return (
    <LanguageOptionsContext.Provider
      value={{ availableLanguages, setAvailableLanguages, clearAvailableLanguages }}
    >
      {children}
    </LanguageOptionsContext.Provider>
  )
}

export function useLanguageOptions() {
  const context = useContext(LanguageOptionsContext)
  if (context === undefined) {
    return null
  }
  return context
}
