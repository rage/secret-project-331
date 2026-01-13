"use client"
import { QueryClient, useQuery } from "@tanstack/react-query"

import { fetchCourseLanguageVersions } from "../services/backend/courses"

import { Course } from "@/shared-module/common/bindings"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const formatLanguageVersionsQueryKey = (courseId: string): string => {
  // eslint-disable-next-line i18next/no-literal-string
  return `course-language-versions-${courseId}`
}

export const invalidateCourseLanguageVersions = (queryClient: QueryClient, courseId: string) => {
  queryClient.invalidateQueries({ queryKey: [formatLanguageVersionsQueryKey(courseId)] })
}

const useCourseLanguageVersions = (courseId: string | null) => {
  const query = useQuery<Course[]>({
    queryKey: [formatLanguageVersionsQueryKey(courseId ?? "")],
    queryFn: () => fetchCourseLanguageVersions(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })

  return query
}

export default useCourseLanguageVersions
