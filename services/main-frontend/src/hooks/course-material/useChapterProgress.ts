"use client"
import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { fetchUserChapterInstanceChapterProgress } from "@/services/course-material/backend"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

export const useChapterProgress = (courseInstanceId: string | undefined, chapterId: string) => {
  const loginStateContext = useContext(LoginStateContext)

  return useQuery({
    queryKey: [`course-instance-${courseInstanceId}-chapter-${chapterId}-progress`],
    queryFn: () => fetchUserChapterInstanceChapterProgress(courseInstanceId!, chapterId),
    enabled: !!courseInstanceId && loginStateContext.signedIn === true,
  })
}
