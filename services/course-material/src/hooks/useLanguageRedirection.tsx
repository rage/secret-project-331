import { useRouter } from "next/router"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { buildLanguageSwitchedUrl } from "../utils/urlBuilder"

import useCourseLanguageVersions from "./useCourseLanguageVersions"

import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"

interface LanguageRedirectionParams {
  currentCourseId: string | null
  currentPageLanguageGroupId: string | null
  languageDataMap: Map<string, { courseSlug: string; pagePath: string }> // Preloaded data from parent
}

interface LanguageOption {
  code: string
  name: string
  courseId: string
}

interface LanguageRedirectionResult {
  availableLanguages: LanguageOption[]
  redirectToLanguage: (languageCode: string) => void
  isRedirecting: boolean
  error: string | null
}

/**
 * Custom hook for handling language redirection in course pages.
 * Uses existing hooks and leverages TanStack Query's automatic caching.
 */
export function useLanguageRedirection({
  currentCourseId,
  currentPageLanguageGroupId,
  languageDataMap,
}: LanguageRedirectionParams): LanguageRedirectionResult {
  const router = useRouter()
  const { t } = useTranslation()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch available language versions for the current course
  const languageVersionsQuery = useCourseLanguageVersions(currentCourseId)

  // Memoize available languages to prevent unnecessary re-renders
  const availableLanguages = useMemo(() => {
    if (!currentCourseId || !languageVersionsQuery.data) {
      return []
    }

    return languageVersionsQuery.data.map((version) => ({
      code: version.language_code,
      name: ietfLanguageTagToHumanReadableName(version.language_code),
      courseId: version.id,
    }))
  }, [languageVersionsQuery.data, currentCourseId])

  const redirectToLanguage = useCallback(
    (languageCode: string) => {
      if (isRedirecting) {
        return
      }

      try {
        setIsRedirecting(true)
        setError(null)

        const languageData = languageDataMap.get(languageCode)
        if (!languageData) {
          throw new Error(`Data not available for language: ${languageCode}`)
        }

        const newUrl = buildLanguageSwitchedUrl(
          window.location.href,
          languageData.courseSlug,
          languageData.pagePath,
        )

        // Only navigate if the URLs are actually different
        const normalizedUrl = newUrl.endsWith("/") ? newUrl : `${newUrl}/`
        const currentUrl = window.location.href.endsWith("/")
          ? window.location.href
          : `${window.location.href}/`

        if (normalizedUrl !== currentUrl) {
          router.push(newUrl)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : t("language-switching-failed")
        setError(errorMessage)
      } finally {
        setIsRedirecting(false)
      }
    },
    [isRedirecting, languageDataMap, router, t],
  )

  return {
    availableLanguages,
    redirectToLanguage,
    isRedirecting,
    error: error || languageVersionsQuery.error?.message || null,
  }
}

export default useLanguageRedirection
