"use client"

import { useQuery } from "@tanstack/react-query"

import { getUserChapterLocks } from "@/services/course-material/backend"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { userChapterLocksQueryKey } from "@/state/course-material/queries"

export const useUserChapterLocks = (courseId: string | null | undefined) => {
  return useQuery({
    queryKey: userChapterLocksQueryKey(courseId),
    queryFn: () => getUserChapterLocks(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}
