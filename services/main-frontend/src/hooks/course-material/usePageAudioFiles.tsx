"use client"

import { skipToken, useQuery } from "@tanstack/react-query"

import { getCourseMaterialPageAudioFiles } from "@/generated/course-material-api/sdk.generated"

interface UsePageAudioFilesOptions {
  enabled?: boolean
}

const COURSE_MATERIAL_PAGE_AUDIO_FILES_QUERY_KEY = "courseMaterialPageAudioFiles"

const usePageAudioFiles = (
  pageId: string | null | undefined,
  courseId: string | null | undefined,
  isMaterialPage: boolean,
  options: UsePageAudioFilesOptions = {},
) => {
  const { enabled = true } = options
  const query = useQuery({
    queryKey: [COURSE_MATERIAL_PAGE_AUDIO_FILES_QUERY_KEY, pageId] as const,
    queryFn: pageId
      ? () =>
          getCourseMaterialPageAudioFiles({
            path: {
              page_id: pageId,
            },
          })
      : skipToken,
    enabled: Boolean(courseId) && isMaterialPage && Boolean(pageId) && enabled,
  })
  return query
}

export default usePageAudioFiles
