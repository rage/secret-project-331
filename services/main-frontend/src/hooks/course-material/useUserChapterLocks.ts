"use client"

import type { QueryClient } from "@tanstack/react-query"
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

/**
 * Refetches user chapter locking statuses for a course.
 * This function can be called after operations that might change chapter locking statuses,
 * such as enrolling in a course instance.
 * @param queryClient - The React Query client instance.
 * @param courseId - The course ID to refetch chapter locks for. If null/undefined, no refetch occurs.
 */
export const refetchUserChapterLocks = async (
  queryClient: QueryClient,
  courseId: string | null | undefined,
) => {
  if (!courseId) {
    return
  }
  await queryClient.refetchQueries({
    queryKey: userChapterLocksQueryKey(courseId),
  })
}
