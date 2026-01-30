"use client"

import { useCallback, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"

import { useLanguageOptions } from "@/contexts/LanguageOptionsContext"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import {
  DEFAULT_LANGUAGE,
  getDir,
  SUPPORTED_LANGUAGES,
} from "@/shared-module/common/hooks/useLanguage"
import { LANGUAGE_COOKIE_KEY } from "@/shared-module/common/utils/constants"
import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function getLanguageLabels(targetCode: string, displayLocale: string) {
  return {
    native: capitalizeFirst(ietfLanguageTagToHumanReadableName(targetCode)),
    localized: capitalizeFirst(ietfLanguageTagToHumanReadableName(targetCode, displayLocale)),
    // eslint-disable-next-line i18next/no-literal-string
    english: capitalizeFirst(ietfLanguageTagToHumanReadableName(targetCode, "en")),
  }
}

export interface LanguageMenuItem {
  id: string
  code: string
  label: string
  nativeLabel: string
  localizedLabel: string
  englishLabel: string
  isSelected: boolean
  isDraft?: boolean
  lang: string
  dir: "ltr" | "rtl"
  onSelect: () => Promise<void>
}

export interface UseLanguageMenuItemsProps {
  availableLanguages?: Array<{
    code: string
    name: string
    isDraft?: boolean
  }>
  onLanguageChange?: (languageCode: string) => Promise<void>
  renderAsSubmenu?: boolean
  onMenuClose?: () => void
}

export interface UseLanguageMenuItemsResult {
  items: LanguageMenuItem[]
  currentLanguage: string
  shouldShow: boolean
  areLanguagesOverridden: boolean
}

export function useLanguageMenuItems({
  availableLanguages: propAvailableLanguages,
  onLanguageChange: propOnLanguageChange,
  renderAsSubmenu = false,
  onMenuClose,
}: UseLanguageMenuItemsProps = {}): UseLanguageMenuItemsResult {
  const { t, i18n } = useTranslation()
  const { alert } = useDialog()
  const isChangingRef = useRef(false)
  const languageOptions = useLanguageOptions()

  const contextLanguages = languageOptions?.availableLanguages
  const availableLanguages = contextLanguages || propAvailableLanguages || []
  const areLanguagesOverridden = !!contextLanguages

  const currentLanguage = i18n.language || DEFAULT_LANGUAGE

  const handleLanguageChange = useCallback(
    async (newLanguageCode: string) => {
      if (isChangingRef.current) {
        return
      }
      if (newLanguageCode === currentLanguage) {
        onMenuClose?.()
        return
      }
      try {
        isChangingRef.current = true
        // Prefer context callback (for course material), then prop callback, then fallback to i18n
        const callback = languageOptions?.onLanguageChange || propOnLanguageChange
        if (callback) {
          await callback(newLanguageCode)
        } else {
          // Set cookie BEFORE calling i18n.changeLanguage so that useLanguage() picks up the new value
          if (typeof document !== "undefined") {
            // eslint-disable-next-line i18next/no-literal-string
            document.cookie = `${LANGUAGE_COOKIE_KEY}=${newLanguageCode}; path=/; SameSite=Strict; max-age=31536000;`
          }
          // Fallback to basic i18n change
          await i18n.changeLanguage(newLanguageCode)
        }
        onMenuClose?.()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error("Language redirection failed:", errorMessage)
        alert(t("language-redirection-failed", { error: errorMessage }))
      } finally {
        isChangingRef.current = false
      }
    },
    [
      languageOptions?.onLanguageChange,
      propOnLanguageChange,
      i18n,
      alert,
      t,
      currentLanguage,
      onMenuClose,
    ],
  )

  // Determine which languages to show: context/props languages or default supported languages
  const languagesToShow =
    availableLanguages.length > 0 && (areLanguagesOverridden || availableLanguages.length > 1)
      ? availableLanguages
      : SUPPORTED_LANGUAGES.map((code) => ({ code }))

  // Hide menu if only one language is available and we're already on it
  const shouldShow = !(
    availableLanguages.length === 1 && availableLanguages[0].code === currentLanguage
  )

  const items: LanguageMenuItem[] = useMemo(() => {
    if (!shouldShow) {
      return []
    }

    return languagesToShow.map((lang) => {
      const code = lang.code
      const { native, localized, english } = getLanguageLabels(code, currentLanguage)
      const selected = code === currentLanguage

      return {
        // eslint-disable-next-line i18next/no-literal-string
        id: `lang-${code}`,
        code,
        label: native,
        nativeLabel: native,
        localizedLabel: localized,
        englishLabel: english,
        isSelected: selected,
        isDraft: "isDraft" in lang ? lang.isDraft : undefined,
        lang: code,
        dir: getDir(code),
        onSelect: () => handleLanguageChange(code),
      }
    })
  }, [languagesToShow, currentLanguage, handleLanguageChange, shouldShow])

  return {
    items,
    currentLanguage,
    shouldShow,
    areLanguagesOverridden,
  }
}
