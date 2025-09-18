import { useQuery } from "@tanstack/react-query"

import { getUserCourseSettingsForUser } from "../services/backend/courses"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useUserCourseSettings = (
  courseId: string | null | undefined,
  userId: string | null | undefined,
) => {
  return useQuery({
    queryKey: ["userCourseSettings", courseId, userId],
    queryFn: () => {
      return getUserCourseSettingsForUser(
        assertNotNullOrUndefined(courseId),
        assertNotNullOrUndefined(userId),
      )
    },
    enabled: !!courseId && !!userId,
  })
}
