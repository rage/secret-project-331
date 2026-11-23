"use client"

import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import ietfLanguageTagToHumanReadableName from "../utils/ietfLanguageTagToHumanReadableName"
import { primaryLanguage } from "../utils/language"

/** Names a language in the UI language, e.g. "Finnish" for `fi-FI`; region variants share one name. */
export default function useLanguageName(): (code: string) => string {
  const { i18n } = useTranslation()
  return useMemo(() => {
    const names = new Map<string, string>()
    return (code: string) => {
      const language = primaryLanguage(code)
      let name = names.get(language)
      if (name === undefined) {
        name = ietfLanguageTagToHumanReadableName(language, i18n.language)
        names.set(language, name)
      }
      return name
    }
  }, [i18n.language])
}
