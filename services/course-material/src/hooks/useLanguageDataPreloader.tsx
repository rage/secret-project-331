import { useQueries, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"

import { fetchCourseById } from "../services/backend"

import useCourseLanguageVersions from "./useCourseLanguageVersions"

interface LanguageDataPreloaderParams {
  currentCourseId: string | null
  currentPageLanguageGroupId: string | null
}

interface LanguageDataPreloaderResult {
  languageDataMap: Map<string, { courseSlug: string; pagePath: string }>
  isLoading: boolean
}

/**
 * Hook that preloads course and page data for all available languages.
 * Uses TanStack Query's useQueries to handle dynamic number of languages.
 */
export function useLanguageDataPreloader({
  currentCourseId,
  currentPageLanguageGroupId,
}: LanguageDataPreloaderParams): LanguageDataPreloaderResult {
  const queryClient = useQueryClient()

  // Fetch available language versions
  const languageVersionsQuery = useCourseLanguageVersions(currentCourseId)
  const availableLanguages = useMemo(
    () => languageVersionsQuery.data || [],
    [languageVersionsQuery.data],
  )

  // Use useQueries to fetch data for all languages dynamically
  const courseQueriesResult = useQueries({
    queries: availableLanguages.map((language) => ({
      queryKey: ["course", language.id], // eslint-disable-line i18next/no-literal-string
      queryFn: () => fetchCourseById(language.id),
      enabled: !!language.id,
    })),
  })

  const pageQueriesResult = useQueries({
    queries: availableLanguages.map((language) => ({
      queryKey: ["page-path", language.id, currentPageLanguageGroupId], // eslint-disable-line i18next/no-literal-string
      queryFn: async () => {
        // Get page path data from query cache or fetch
        const cacheKey = ["new-page-path", language.id, currentPageLanguageGroupId] // eslint-disable-line i18next/no-literal-string
        const cachedData = queryClient.getQueryData(cacheKey)
        if (cachedData) {
          return cachedData
        }

        // If not cached, this will be loaded by the useNewPagePath hook elsewhere
        return null
      },
      enabled: !!language.id && !!currentPageLanguageGroupId,
    })),
  })

  // Destructure the values for stable dependencies
  const courseData = courseQueriesResult.map((q) => q.data)
  const pageData = pageQueriesResult.map((q) => q.data)
  const courseLoading = courseQueriesResult.map((q) => q.isLoading)
  const pageLoading = pageQueriesResult.map((q) => q.isLoading)

  // Build the language data map
  const languageDataMap = useMemo(() => {
    const map = new Map<string, { courseSlug: string; pagePath: string }>()

    availableLanguages.forEach((language, index) => {
      const course = courseData[index]
      const page = pageData[index]

      if (course?.slug && page && typeof page === "string") {
        map.set(language.language_code, {
          courseSlug: course.slug,
          pagePath: page,
        })
      }
    })

    return map
  }, [availableLanguages, courseData, pageData])

  // Check loading state
  const isLoading = useMemo(() => {
    return courseLoading.some(Boolean) || pageLoading.some(Boolean)
  }, [courseLoading, pageLoading])

  return {
    languageDataMap,
    isLoading,
  }
}

export default useLanguageDataPreloader
