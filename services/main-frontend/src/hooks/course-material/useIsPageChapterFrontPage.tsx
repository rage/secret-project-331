"use client"

import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"

import { getCourseMaterialIsPageChapterFrontPageOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { viewParamsAtom } from "@/state/course-material/params"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const useIsPageChapterFrontPage = (pageId: string | undefined) => {
  const viewParams = useAtomValue(viewParamsAtom)
  // A staged page may not exist yet, so the server cannot answer for it.
  const stagedAnswer = viewParams?.type === "preview" ? viewParams.isChapterFrontPage : undefined
  const isChapterFrontPageQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: pageId,
      isReady: (id): id is string => Boolean(id),
      enabled: stagedAnswer === undefined,
      build: (id) =>
        getCourseMaterialIsPageChapterFrontPageOptions({
          path: {
            current_page_id: id,
          },
        }),
    }),
  )
  return {
    data:
      stagedAnswer === undefined
        ? isChapterFrontPageQuery.data
        : { is_chapter_front_page: stagedAnswer },
    isLoading: isChapterFrontPageQuery.isLoading,
  }
}

export default useIsPageChapterFrontPage
