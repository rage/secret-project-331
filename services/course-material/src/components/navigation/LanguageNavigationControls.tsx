import React, { useCallback, useContext } from "react"
import { useTranslation } from "react-i18next"

import LayoutContext from "../../contexts/LayoutContext"
import PageContext from "../../contexts/PageContext"
import useLanguageNavigation from "../../hooks/useLanguageNavigation"

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
 * Simplified to use the unified useLanguageNavigation hook.
 */
const LanguageNavigationControls: React.FC<LanguageNavigationControlsProps> = ({
  placement = "bottom-end",
}) => {
  const { alert } = useDialog()
  const layoutContext = useContext(LayoutContext)
  const pageState = useContext(PageContext)
  const { t } = useTranslation()

  const currentCourseId = layoutContext.courseId || pageState.course?.id || null

  const { availableLanguages, redirectToLanguage, isLoading, error } = useLanguageNavigation({
    currentCourseId,
  })

  const languageOptions: LanguageOption[] = availableLanguages.map((lang) => ({
    tag: lang.code,
    name: lang.name,
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

  // If we don't have course-specific languages yet, show a simple language selector
  // that will use the default behavior until course data loads
  // TODO: FIX THIS
  return <LanguageSelection placement={placement} handleLanguageChange={handleLanguageChange} />
}

export default LanguageNavigationControls
