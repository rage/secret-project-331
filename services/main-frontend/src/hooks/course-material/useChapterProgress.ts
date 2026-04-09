"use client"

import { skipToken, useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getCourseMaterialChapterProgress } from "@/generated/course-material-api/sdk.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

/**
 * Hook to fetch user progress for a specific chapter in a course instance.
 * Returns progress information including score given, score maximum, and exercise completion status.
 * @param courseInstanceId - The course instance ID. Query is disabled if undefined.
 * @param chapterId - The chapter ID to fetch progress for.
 * @returns React Query result containing the user's chapter progress data.
 */
export const useChapterProgress = (courseInstanceId: string | undefined, chapterId: string) => {
  const loginStateContext = useContext(LoginStateContext)

  return useQuery({
    queryKey: ["courseMaterialChapterProgress", courseInstanceId, chapterId] as const,
    queryFn: courseInstanceId
      ? () =>
          getCourseMaterialChapterProgress({
            path: {
              chapter_id: chapterId,
              course_instance_id: courseInstanceId,
            },
          })
      : skipToken,
    enabled: !!courseInstanceId && loginStateContext.signedIn === true,
  })
}
