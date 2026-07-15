"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialIsPageChapterFrontPageOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const useIsPageChapterFrontPage = (pageId: string | undefined) => {
  const isChapterFrontPageQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: pageId,
      isReady: (id): id is string => Boolean(id),
      build: (id) =>
        getCourseMaterialIsPageChapterFrontPageOptions({
          path: {
            current_page_id: id,
          },
        }),
    }),
  )
  return isChapterFrontPageQuery
}

export default useIsPageChapterFrontPage
