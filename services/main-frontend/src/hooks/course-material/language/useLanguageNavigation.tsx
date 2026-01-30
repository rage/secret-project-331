"use client"

import { type LanguageOption, useCourseLanguageVersions } from "./useCourseLanguageVersions"

interface LanguageNavigationParams {
  currentCourseId: string | null
  currentPageId: string | null
}

interface LanguageNavigationResult {
  availableLanguages: LanguageOption[]
  getLanguageUrl: (languageCode: string) => string | null
  isLoading: boolean
  error: string | null
}

/**
 * Data hook for course language navigation.
 * Provides available languages and URL building utilities.
 * Does NOT perform redirects - use useCourseMaterialLanguageRedirection for automatic redirects.
 */
export function useLanguageNavigation({
  currentCourseId,
  currentPageId,
}: LanguageNavigationParams): LanguageNavigationResult {
  const { availableLanguages, getLanguageUrl, isLoading, error } = useCourseLanguageVersions({
    currentCourseId,
    currentPageId,
  })

  return {
    availableLanguages,
    getLanguageUrl,
    isLoading,
    error,
  }
}

export default useLanguageNavigation
