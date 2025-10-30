"use client"
import React, { useCallback, useContext } from "react"
import { useTranslation } from "react-i18next"

import LayoutContext from "@/contexts/course-material/LayoutContext"
import PageContext from "@/contexts/course-material/PageContext"
import useLanguageNavigation from "@/hooks/course-material/useLanguageNavigation"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import LanguageSelection, {
  LanguageOption,
} from "@/shared-module/common/components/LanguageSelection"
import Spinner from "@/shared-module/common/components/Spinner"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"

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
  const layoutContext = useContext(LayoutContext)
  const pageState = useContext(PageContext)
  const { t } = useTranslation()

  const currentCourseId = (layoutContext.courseId || pageState.course?.id) ?? null

  const { availableLanguages, redirectToLanguage, isLoading, error } = useLanguageNavigation({
    currentCourseId,
    currentPageId: pageState.pageData?.id ?? null,
  })

  const languageOptions: LanguageOption[] = availableLanguages.map((lang) => ({
    tag: lang.code,
    name: lang.isDraft ? `${lang.name} (${t("draft")})` : lang.name,
  }))

  const handleLanguageChange = useCallback(
    async (newLanguageCode: string) => {
      try {
        await redirectToLanguage(newLanguageCode)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error("Language redirection failed:", errorMessage)
        alert(t("language-redirection-failed", { error: errorMessage }))
      }
    },
    [redirectToLanguage, alert, t],
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
  const currentLanguageCode = pageState.course?.language_code
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
