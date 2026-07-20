import { useQuery } from "@tanstack/react-query"

import { getCourseProgressForUserOptions } from "@/generated/api/@tanstack/react-query.generated"

/** Fetches UserCourseProgress for the given course and user. */
export const useUserCourseProgress = (courseId: string, userId: string) => {
  return useQuery({
    ...getCourseProgressForUserOptions({
      path: {
        course_id: courseId,
        user_id: userId,
      },
    }),
    enabled: !!courseId && !!userId,
  })
}
