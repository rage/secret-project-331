import { useRouter } from "next/router"
import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { buildLanguageSwitchedUrl } from "../utils/urlBuilder"

import useCourseLanguageVersionNavigationInfos from "./useCourseLanguageVersionNavigationInfos"

import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"

interface LanguageNavigationParams {
  currentCourseId: string | null
  currentPageId: string | null
}

interface LanguageOption {
  code: string
  name: string
  courseId: string
  courseSlug: string
  pagePath: string
  isDraft: boolean
}

interface LanguageNavigationResult {
  availableLanguages: LanguageOption[]
  redirectToLanguage: (languageCode: string) => Promise<void>
  getLanguageUrl: (languageCode: string) => string | null
  isLoading: boolean
  error: string | null
}

/**
 * Normalizes URLs for comparison by ensuring consistent trailing slash handling.
 */
function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`
}

/**
 * Builds a language-switched URL, handling /org/ prefix detection to avoid duplication.
 */
function buildLanguageSwitchedUrlWithPrefixHandling(
  currentUrl: string,
  courseSlug: string,
  pagePath: string,
): string {
  // Always use buildLanguageSwitchedUrl - it should handle the /org/ prefix logic internally
  const url = buildLanguageSwitchedUrl(currentUrl, courseSlug, pagePath)

  // Check if the result has double /org/ prefix and remove one if needed
  const hasorgPrefix = url.startsWith("/org")
  if (hasorgPrefix) {
    // eslint-disable-next-line i18next/no-literal-string
    return url.replace("/org", "/org")
  }

  return url
}

/**
 * Simplified hook for language navigation using data directly from navigationInfo.
 * All necessary data (course slug, page path) is already available in the navigation info.
 */
export function useLanguageNavigation({
  currentCourseId,
  currentPageId,
}: LanguageNavigationParams): LanguageNavigationResult {
  const router = useRouter()
  const { t } = useTranslation()

  const languageVersionsQuery = useCourseLanguageVersionNavigationInfos(
    currentCourseId,
    currentPageId,
  )

  const availableLanguages = useMemo((): LanguageOption[] => {
    if (!languageVersionsQuery.data) {
      return []
    }

    return languageVersionsQuery.data.map((version) => ({
      code: version.language_code,
      name: ietfLanguageTagToHumanReadableName(version.language_code),
      courseId: version.course_id,
      courseSlug: version.course_slug,
      pagePath: version.page_path,
      isDraft: version.is_draft,
    }))
  }, [languageVersionsQuery.data])

  const languageDataMap = useMemo(() => {
    const map = new Map<string, { courseSlug: string; pagePath: string }>()

    availableLanguages.forEach((language) => {
      map.set(language.code, {
        courseSlug: language.courseSlug,
        pagePath: language.pagePath,
      })
    })

    return map
  }, [availableLanguages])

  const getLanguageUrl = useCallback(
    (languageCode: string): string | null => {
      try {
        const languageData = languageDataMap.get(languageCode)
        if (!languageData) {
          return null
        }

        const currentUrl = window.location.href
        return buildLanguageSwitchedUrlWithPrefixHandling(
          currentUrl,
          languageData.courseSlug,
          languageData.pagePath,
        )
      } catch (err) {
        console.error("Failed to generate language URL:", err)
        return null
      }
    },
    [languageDataMap],
  )

  const redirectToLanguage = useCallback(
    async (languageCode: string) => {
      try {
        const newUrl = getLanguageUrl(languageCode)
        if (!newUrl) {
          throw new Error(`Data not available for language: ${languageCode}`)
        }

        const currentUrl = window.location.href
        // Only navigate if URLs are different (normalized comparison)
        const normalizedCurrentUrl = normalizeUrl(currentUrl)
        const normalizedTargetUrl = normalizeUrl(newUrl)

        if (normalizedCurrentUrl !== normalizedTargetUrl) {
          await router.push(newUrl)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : t("language-switching-failed")
        console.error("Language redirection failed:", errorMessage)
        throw new Error(errorMessage)
      }
    },
    [getLanguageUrl, router, t],
  )

  return {
    availableLanguages,
    redirectToLanguage,
    getLanguageUrl,
    isLoading: languageVersionsQuery.isLoading,
    error: languageVersionsQuery.error?.message || null,
  }
}

export default useLanguageNavigation
