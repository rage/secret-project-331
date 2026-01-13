"use client"

import { useCallback, useMemo } from "react"

import useCourseLanguageVersionNavigationInfos from "../useCourseLanguageVersionNavigationInfos"

import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"
import { buildLanguageSwitchedUrl } from "@/utils/course-material/urlBuilder"

export interface LanguageOption {
  code: string
  name: string
  courseId: string
  courseSlug: string
  pagePath: string
  isDraft: boolean
  currentPageUnavailableInThisLanguage: boolean
}

interface LanguageData {
  courseSlug: string
  pagePath: string
  currentPageUnavailableInThisLanguage: boolean
}

interface UseCourseLanguageVersionsParams {
  currentCourseId: string | null
  currentPageId: string | null
}

interface UseCourseLanguageVersionsResult {
  availableLanguages: LanguageOption[]
  getLanguageUrl: (languageCode: string) => string | null
  languageDataMap: Map<string, LanguageData>
  isLoading: boolean
  error: string | null
  queryData: ReturnType<typeof useCourseLanguageVersionNavigationInfos>["data"]
}

/**
 * Base hook for course language version data.
 * Shared by useLanguageNavigation and useCourseMaterialLanguageRedirection.
 * Do not use directly - use the public hooks instead.
 */
export function useCourseLanguageVersions({
  currentCourseId,
  currentPageId,
}: UseCourseLanguageVersionsParams): UseCourseLanguageVersionsResult {
  const languageVersionsQuery = useCourseLanguageVersionNavigationInfos(
    currentCourseId,
    currentPageId,
  )

  const availableLanguages = useMemo((): LanguageOption[] => {
    if (!languageVersionsQuery.data) {
      return []
    }

    const languages = languageVersionsQuery.data.map((version) => ({
      code: version.language_code,
      name: ietfLanguageTagToHumanReadableName(version.language_code),
      courseId: version.course_id,
      courseSlug: version.course_slug,
      pagePath: version.page_path,
      isDraft: version.is_draft,
      currentPageUnavailableInThisLanguage: version.current_page_unavailable_in_this_language,
    }))

    return languages
  }, [languageVersionsQuery.data])

  const languageDataMap = useMemo(() => {
    return new Map(
      availableLanguages.map((language) => [
        language.code,
        {
          courseSlug: language.courseSlug,
          pagePath: language.pagePath,
          currentPageUnavailableInThisLanguage: language.currentPageUnavailableInThisLanguage,
        },
      ]),
    )
  }, [availableLanguages])

  const getLanguageUrl = useCallback(
    (languageCode: string): string | null => {
      try {
        const languageData = languageDataMap.get(languageCode)
        if (!languageData) {
          console.warn(`Language version not found: ${languageCode}`)
          return null
        }

        const currentUrl = window.location.href
        const newUrl = buildLanguageSwitchedUrl(
          currentUrl,
          languageData.courseSlug,
          languageData.pagePath,
        )
        return newUrl
      } catch (err) {
        console.error(`Failed to generate language URL for ${languageCode}:`, err)
        return null
      }
    },
    [languageDataMap],
  )

  return {
    availableLanguages,
    getLanguageUrl,
    languageDataMap,
    isLoading: languageVersionsQuery.isLoading,
    error: languageVersionsQuery.error?.message || null,
    queryData: languageVersionsQuery.data,
  }
}
