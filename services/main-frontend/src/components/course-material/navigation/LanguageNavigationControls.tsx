"use client"

import { useAtomValue } from "jotai"
import React, { useCallback } from "react"
import { useTranslation } from "react-i18next"

import useLanguageNavigation from "@/hooks/course-material/language/useLanguageNavigation"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import LanguageSelection, {
  LanguageOption,
} from "@/shared-module/common/components/LanguageSelection"
import Spinner from "@/shared-module/common/components/Spinner"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import {
  currentCourseIdAtom,
  currentPageDataAtom,
  materialCourseAtom,
} from "@/state/course-material/selectors"
import { useChangeCourseMaterialLanguage } from "@/utils/course-material/languageHelpers"

interface LanguageNavigationControlsProps {
  placement?: "bottom-end" | "bottom-start"
}

/**
 * Reusable component for language navigation in course contexts.
 */
const LanguageNavigationControls: React.FC<LanguageNavigationControlsProps> = ({
  placement = "bottom-end",
}) => {
  const { alert } = useDialog()
  const currentCourseId = useAtomValue(currentCourseIdAtom)
  const materialCourse = useAtomValue(materialCourseAtom)
  const pageData = useAtomValue(currentPageDataAtom)
  const { t } = useTranslation()

  const { availableLanguages, isLoading, error } = useLanguageNavigation({
    currentCourseId,
    currentPageId: pageData?.id ?? null,
  })
  const changeCourseMaterialLanguage = useChangeCourseMaterialLanguage()

  const languageOptions: LanguageOption[] = availableLanguages.map((lang) => ({
    tag: lang.code,
    name: lang.isDraft ? `${lang.name} (${t("draft")})` : lang.name,
  }))

  const handleLanguageChange = useCallback(
    async (newLanguageCode: string) => {
      try {
        // Update state - the redirect will be handled by useCourseMaterialLanguageRedirection hook
        changeCourseMaterialLanguage(newLanguageCode)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error("Language change failed:", errorMessage)
        alert(t("language-redirection-failed", { error: errorMessage }))
      }
    },
    [changeCourseMaterialLanguage, alert, t],
  )

  if (error) {
    return <ErrorBanner error={error} />
  }

  if (isLoading) {
    return <Spinner variant="medium" />
  }

  if (languageOptions.length > 1) {
    return (
      <LanguageSelection
        placement={placement}
        languages={languageOptions}
        handleLanguageChange={handleLanguageChange}
      />
    )
  }

  // Additional safety check: verify we're actually on the only offered version
  const currentLanguageCode = materialCourse?.language_code
  const isOnOnlyOfferedVersion =
    languageOptions.length === 1 &&
    currentLanguageCode &&
    languageOptions[0]?.tag === currentLanguageCode

  if (isOnOnlyOfferedVersion || languageOptions.length === 0) {
    return null
  }

  console.warn("Available languages length is 1, but we're not on the only offered version")
  return (
    <LanguageSelection
      placement={placement}
      languages={languageOptions}
      handleLanguageChange={handleLanguageChange}
    />
  )
}

export default LanguageNavigationControls
