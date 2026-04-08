"use client"

import { useQuery } from "@tanstack/react-query"

import { getUserCourseSettingsForUserOptions } from "../services/backend/courses"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useUserCourseSettings = (
  courseId: string | null | undefined,
  userId: string | null | undefined,
) => {
  return useQuery({
    ...getUserCourseSettingsForUserOptions(
      assertNotNullOrUndefined(courseId),
      assertNotNullOrUndefined(userId),
    ),
    enabled: !!courseId && !!userId,
  })
}
