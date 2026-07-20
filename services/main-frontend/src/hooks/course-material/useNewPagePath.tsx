"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialPageByCourseIdAndLanguageGroupIdOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const useNewPagePath = (
  course_id: string | undefined,
  page_language_group_id: string | undefined | null,
): string | null => {
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: {
        courseId: course_id,
        pageLanguageGroupId: page_language_group_id,
      },
      isReady: (
        value,
      ): value is {
        courseId: string
        pageLanguageGroupId: string
      } => Boolean(value?.courseId && value.pageLanguageGroupId),
      build: ({ courseId, pageLanguageGroupId }) =>
        getCourseMaterialPageByCourseIdAndLanguageGroupIdOptions({
          path: {
            course_id: courseId,
            page_language_group_id: pageLanguageGroupId,
          },
        }),
    }),
  )
  return query.data?.url_path ?? null
}
export default useNewPagePath
