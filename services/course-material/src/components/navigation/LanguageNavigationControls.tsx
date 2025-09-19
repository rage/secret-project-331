import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import LayoutContext from "../../contexts/LayoutContext"
import PageContext from "../../contexts/PageContext"
import useLanguageDataPreloader from "../../hooks/useLanguageDataPreloader"
import useLanguageRedirection from "../../hooks/useLanguageRedirection"

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
 * Handles the complexity of language switching with proper error handling.
 */
const LanguageNavigationControls: React.FC<LanguageNavigationControlsProps> = ({
  placement = "bottom-end",
}) => {
  const { alert } = useDialog()
  const layoutContext = useContext(LayoutContext)
  const pageState = useContext(PageContext)
  const { t } = useTranslation()

  // Use the most reliable course ID source
  const currentCourseId = layoutContext.courseId || pageState.course?.id || null
  const currentPageLanguageGroupId = pageState.pageData?.page_language_group_id ?? null

  // Preload data for all languages
  const { languageDataMap, isLoading } = useLanguageDataPreloader({
    currentCourseId,
    currentPageLanguageGroupId,
  })

  const { availableLanguages, redirectToLanguage, error } = useLanguageRedirection({
    currentCourseId,
    currentPageLanguageGroupId,
    languageDataMap,
  })

  // Transform available languages to the format expected by LanguageSelection
  const languageOptions: LanguageOption[] = availableLanguages.map((lang) => ({
    tag: lang.code,
    name: lang.name,
  }))

  const handleLanguageChange = (newLanguageCode: string) => {
    try {
      // Use instant redirection with preloaded data
      redirectToLanguage(newLanguageCode)
    } catch (err) {
      console.error(`Language redirection failed: ${err}`)
      alert(t("language-redirection-failed", { error: err }))
    }
  }

  // Show error state if there's an error
  if (error) {
    return <ErrorBanner error={error} />
  }

  // Show loading state while loading language data
  if (isLoading) {
    return <Spinner variant="medium" />
  }

  // Always use course-specific redirection logic in course-material service
  // If we have course-specific languages, use them; otherwise show a simple selector
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
  return <LanguageSelection placement={placement} handleLanguageChange={handleLanguageChange} />
}

export default LanguageNavigationControls
