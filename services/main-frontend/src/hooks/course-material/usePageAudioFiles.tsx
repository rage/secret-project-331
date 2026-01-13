"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchPageAudioFiles } from "@/services/course-material/backend"

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
  const query = useQuery({
    queryKey: [`page-${pageId}-audio-files`, courseId, isMaterialPage],
    queryFn: () => (courseId && isMaterialPage && pageId ? fetchPageAudioFiles(pageId) : []),
    enabled: enabled,
  })
  return query
}

export default usePageAudioFiles
