"use client"

import { useQuery } from "@tanstack/react-query"

import { getUserChapterLocks } from "@/services/course-material/backend"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import { userChapterLocksQueryKey } from "@/state/course-material/queries"

/**
 * Hook to fetch user chapter locking statuses for a course.
 * Returns the locking statuses for all chapters in the course for the current user.
 * @param courseId - The course ID to fetch chapter locks for. If null/undefined, the query is disabled.
 * @returns React Query result containing the user's chapter locking statuses.
 */
export const useUserChapterLocks = (courseId: string | null | undefined) => {
  return useQuery({
    queryKey: userChapterLocksQueryKey(courseId),
    queryFn: () => getUserChapterLocks(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}
