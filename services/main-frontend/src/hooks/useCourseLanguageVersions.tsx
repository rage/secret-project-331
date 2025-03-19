import { useQuery, UseQueryResult } from "@tanstack/react-query"

import { fetchCourseLanguageVersions } from "../services/backend/courses"

import { Course } from "@/shared-module/common/bindings"

export const formatLanguageVersionsQueryKey = (courseId: string): string => {
  // eslint-disable-next-line i18next/no-literal-string
  return `course-${courseId}-language-versions`
}

const useCourseLanguageVersionsQuery = (courseId: string): UseQueryResult<Course[], Error> => {
  return useQuery({
    queryKey: [formatLanguageVersionsQueryKey(courseId)],
    queryFn: () => fetchCourseLanguageVersions(courseId),
  })
}

export default useCourseLanguageVersionsQuery
