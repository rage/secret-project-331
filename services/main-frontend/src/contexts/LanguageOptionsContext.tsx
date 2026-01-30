"use client"

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react"

export interface LanguageOption {
  code: string
  name?: string
  isDraft?: boolean
}

interface LanguageOptionsContextValue {
  availableLanguages: LanguageOption[] | null
  setAvailableLanguages: (languages: LanguageOption[] | null) => void
  clearAvailableLanguages: () => void
  onLanguageChange?: (languageCode: string) => Promise<void> | void
  setOnLanguageChange?: (
    callback: ((languageCode: string) => Promise<void> | void) | undefined,
  ) => void
}

const LanguageOptionsContext = createContext<LanguageOptionsContextValue | undefined>(undefined)

export function LanguageOptionsProvider({ children }: { children: ReactNode }) {
  const [availableLanguages, setAvailableLanguagesState] = useState<LanguageOption[] | null>(null)
  const [onLanguageChange, setOnLanguageChangeState] = useState<
    ((languageCode: string) => Promise<void> | void) | undefined
  >(undefined)

  const setAvailableLanguages = useCallback((languages: LanguageOption[] | null) => {
    setAvailableLanguagesState(languages)
  }, [])

  const clearAvailableLanguages = useCallback(() => {
    setAvailableLanguagesState(null)
  }, [])

  const setOnLanguageChange = useCallback(
    (callback: ((languageCode: string) => Promise<void> | void) | undefined) => {
      if (!callback) {
        setOnLanguageChangeState(undefined)
        return
      }
      setOnLanguageChangeState(() => callback)
    },
    [],
  )

  const contextValue = useMemo(
    () => ({
      availableLanguages,
      setAvailableLanguages,
      clearAvailableLanguages,
      onLanguageChange,
      setOnLanguageChange,
    }),
    [
      availableLanguages,
      onLanguageChange,
      setAvailableLanguages,
      clearAvailableLanguages,
      setOnLanguageChange,
    ],
  )

  return (
    <LanguageOptionsContext.Provider value={contextValue}>
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
