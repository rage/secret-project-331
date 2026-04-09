"use client"

import { skipToken, useQuery } from "@tanstack/react-query"

import { getCourseMaterialIsPageChapterFrontPage } from "@/generated/course-material-api/sdk.generated"

const COURSE_MATERIAL_IS_PAGE_CHAPTER_FRONT_PAGE_QUERY_KEY = "courseMaterialIsPageChapterFrontPage"

const useIsPageChapterFrontPage = (pageId: string | undefined) => {
  const isChapterFrontPageQuery = useQuery({
    queryKey: [COURSE_MATERIAL_IS_PAGE_CHAPTER_FRONT_PAGE_QUERY_KEY, pageId] as const,
    queryFn: pageId
      ? () =>
          getCourseMaterialIsPageChapterFrontPage({
            path: {
              current_page_id: pageId,
            },
            throwOnError: true,
          })
      : skipToken,
    enabled: !!pageId,
  })
  return isChapterFrontPageQuery
}

export default useIsPageChapterFrontPage
