"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseUserSettingsForUserOptions } from "@/generated/api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

export const useUserCourseSettings = (
  courseId: string | null | undefined,
  userId: string | null | undefined,
) => {
  return useQuery(
    optionalGeneratedQueryOptions({
      value: courseId && userId ? { courseId, userId } : null,
      isReady: (
        value,
      ): value is {
        courseId: string
        userId: string
      } => Boolean(value?.courseId && value?.userId),
      build: ({ courseId, userId }) =>
        getCourseUserSettingsForUserOptions({
          path: {
            course_id: courseId,
            user_id: userId,
          },
        }),
    }),
  )
}
