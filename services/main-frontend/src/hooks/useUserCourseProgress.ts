import { useQuery } from "@tanstack/react-query"

import { getCourseProgressForUserOptions } from "../services/backend/courses"

/** Fetches UserCourseProgress for the given course and user. */
export const useUserCourseProgress = (courseId: string, userId: string) => {
  return useQuery({
    ...getCourseProgressForUserOptions(courseId, userId),
    enabled: !!courseId && !!userId,
  })
}
