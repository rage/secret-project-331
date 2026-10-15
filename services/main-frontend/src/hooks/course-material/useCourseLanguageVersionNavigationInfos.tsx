"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialLanguageVersionNavigationInfosOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const useCourseLanguageVersionNavigationInfos = (
  courseId: string | undefined | null,
  page_id: string | undefined | null,
) => {
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: { courseId, pageId: page_id },
      isReady: (
        value,
      ): value is {
        courseId: string
        pageId: string
      } => Boolean(value?.courseId && value.pageId),
      build: ({ courseId: id, pageId }) => ({
        ...getCourseMaterialLanguageVersionNavigationInfosOptions({
          path: {
            course_id: id,
            page_id: pageId,
          },
        }),
        staleTime: 5 * 60 * 1000,
      }),
    }),
  )
  return query
}
export default useCourseLanguageVersionNavigationInfos
