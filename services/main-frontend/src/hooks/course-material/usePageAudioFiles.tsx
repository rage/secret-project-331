"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialPageAudioFilesOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UsePageAudioFilesOptions {
  enabled?: boolean
}

const usePageAudioFiles = (
  pageId: string | null | undefined,
  courseId: string | null | undefined,
  isMaterialPage: boolean,
  options: UsePageAudioFilesOptions = {},
) => {
  const { enabled = true } = options
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: pageId,
      enabled: Boolean(courseId) && isMaterialPage && enabled,
      isReady: (resolvedPageId): resolvedPageId is string => Boolean(resolvedPageId),
      build: (resolvedPageId) =>
        getCourseMaterialPageAudioFilesOptions({
          path: {
            page_id: resolvedPageId,
          },
        }),
    }),
  )
  return query
}

export default usePageAudioFiles
