"use client"
import { useQuery } from "@tanstack/react-query"

import { fetchCourseLanguageVersionNavigationInfos } from "@/services/backend"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const useCourseLanguageVersionNavigationInfos = (
  courseId: string | undefined | null,
  page_id: string | undefined | null,
) => {
  const query = useQuery({
    queryKey: ["course-language-version-navigation-infos", courseId, page_id],
    queryFn: () => {
      return fetchCourseLanguageVersionNavigationInfos(
        assertNotNullOrUndefined(courseId),
        assertNotNullOrUndefined(page_id),
      )
    },
    enabled:
      courseId !== undefined && courseId !== null && page_id !== undefined && page_id !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes - language versions don't change often
  })
  return query
}
export default useCourseLanguageVersionNavigationInfos
