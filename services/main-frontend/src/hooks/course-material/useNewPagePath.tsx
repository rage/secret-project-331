"use client"

import { skipToken, useQuery } from "@tanstack/react-query"

import { getCourseMaterialPageByCourseIdAndLanguageGroupId } from "@/generated/course-material-api/sdk.generated"

const COURSE_MATERIAL_NEW_PAGE_PATH_QUERY_KEY = "courseMaterialNewPagePath"

const useNewPagePath = (
  course_id: string | undefined,
  page_language_group_id: string | undefined | null,
): string | null => {
  const query = useQuery({
    queryKey: [COURSE_MATERIAL_NEW_PAGE_PATH_QUERY_KEY, course_id, page_language_group_id] as const,
    queryFn:
      course_id && page_language_group_id
        ? () =>
            getCourseMaterialPageByCourseIdAndLanguageGroupId({
              path: {
                course_id,
                page_language_group_id,
              },
              throwOnError: true,
            })
        : skipToken,
    enabled: !!course_id && !!page_language_group_id,
  })
  return query.data?.url_path ?? null
}
export default useNewPagePath
