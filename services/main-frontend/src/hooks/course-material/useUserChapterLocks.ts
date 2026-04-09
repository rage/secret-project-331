"use client"

import type { QueryClient } from "@tanstack/react-query"
import { skipToken, useQuery } from "@tanstack/react-query"

import { getCourseMaterialUserChapterLocksQueryKey } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { getCourseMaterialUserChapterLocks } from "@/generated/course-material-api/sdk.generated"
import type { UserChapterLockingStatus } from "@/generated/course-material-api/types.generated"
import { userChapterLocksQueryKey } from "@/state/course-material/queries"

/**
 * Hook to fetch user chapter locking statuses for a course.
 * Returns the locking statuses for all chapters in the course for the current user.
 * @param courseId - The course ID to fetch chapter locks for. If null/undefined, the query is disabled.
 * @returns React Query result containing the user's chapter locking statuses.
 */
export const useUserChapterLocks = (courseId: string | null | undefined) => {
  return useQuery({
    queryKey: ["courseUserChapterLocks", courseId] as const,
    queryFn: courseId
      ? () =>
          getCourseMaterialUserChapterLocks({
            path: {
              course_id: courseId,
            },
            throwOnError: true,
          })
      : skipToken,
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
    queryKey:
      userChapterLocksQueryKey(courseId) ??
      getCourseMaterialUserChapterLocksQueryKey({
        path: {
          course_id: courseId,
        },
      }),
  })
}
