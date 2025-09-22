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
}

interface LanguageNavigationResult {
  availableLanguages: LanguageOption[]
  redirectToLanguage: (languageCode: string) => Promise<void>
  isLoading: boolean
  error: string | null
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

  const redirectToLanguage = useCallback(
    async (languageCode: string) => {
      try {
        const languageData = languageDataMap.get(languageCode)
        if (!languageData) {
          throw new Error(`Data not available for language: ${languageCode}`)
        }

        const newUrl = buildLanguageSwitchedUrl(
          window.location.href,
          languageData.courseSlug,
          languageData.pagePath,
        )

        // Only navigate if URLs are different (normalized comparison)
        const normalizeUrl = (url: string) => (url.endsWith("/") ? url : `${url}/`)
        const currentUrl = normalizeUrl(window.location.href)
        const targetUrl = normalizeUrl(newUrl)

        if (currentUrl !== targetUrl) {
          await router.push(newUrl)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : t("language-switching-failed")
        console.error("Language redirection failed:", errorMessage)
        throw new Error(errorMessage)
      }
    },
    [languageDataMap, router, t],
  )

  return {
    availableLanguages,
    redirectToLanguage,
    isLoading: languageVersionsQuery.isLoading,
    error: languageVersionsQuery.error?.message || null,
  }
}

export default useLanguageNavigation
