"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialIsPageChapterFrontPageOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const useIsPageChapterFrontPage = (pageId: string | undefined) => {
  const isChapterFrontPageQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: pageId,
      isReady: (pageId): pageId is string => Boolean(pageId),
      build: (pageId) =>
        getCourseMaterialIsPageChapterFrontPageOptions({
          path: {
            current_page_id: pageId,
          },
        }),
    }),
  )
  return isChapterFrontPageQuery
}

export default useIsPageChapterFrontPage
