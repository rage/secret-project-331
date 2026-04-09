"use client"

import { queryOptions, useQuery } from "@tanstack/react-query"

import { getCourseUserSettingsForUser as getUserCourseSettingsForUserFromApi } from "@/generated/api/sdk.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const GET_USER_COURSE_SETTINGS_FOR_USER_QUERY_KEY = "getCourseUserSettingsForUser"

const getUserCourseSettingsForUserQueryOptions = (
  courseId: string | null | undefined,
  userId: string | null | undefined,
) =>
  queryOptions({
    queryKey: [
      {
        _id: GET_USER_COURSE_SETTINGS_FOR_USER_QUERY_KEY,
        path: { course_id: courseId, user_id: userId },
      },
    ] as const,
    queryFn: () =>
      getUserCourseSettingsForUserFromApi({
        path: {
          course_id: assertNotNullOrUndefined(courseId),
          user_id: assertNotNullOrUndefined(userId),
        },
        throwOnError: true,
      }),
  })

export const useUserCourseSettings = (
  courseId: string | null | undefined,
  userId: string | null | undefined,
) => {
  return useQuery({
    ...getUserCourseSettingsForUserQueryOptions(courseId, userId),
    enabled: !!courseId && !!userId,
  })
}
