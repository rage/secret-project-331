"use client"

import { skipToken, useQuery } from "@tanstack/react-query"

import { getCourseMaterialLanguageVersionNavigationInfos } from "@/generated/course-material-api/sdk.generated"

const COURSE_MATERIAL_LANGUAGE_VERSION_NAVIGATION_INFOS_QUERY_KEY =
  "courseMaterialLanguageVersionNavigationInfos"

const useCourseLanguageVersionNavigationInfos = (
  courseId: string | undefined | null,
  page_id: string | undefined | null,
) => {
  const query = useQuery({
    queryKey: [
      COURSE_MATERIAL_LANGUAGE_VERSION_NAVIGATION_INFOS_QUERY_KEY,
      courseId,
      page_id,
    ] as const,
    queryFn:
      courseId && page_id
        ? () =>
            getCourseMaterialLanguageVersionNavigationInfos({
              path: {
                course_id: courseId,
                page_id,
              },
            })
        : skipToken,
    enabled: !!courseId && !!page_id,
    staleTime: 5 * 60 * 1000,
  })
  return query
}
export default useCourseLanguageVersionNavigationInfos
