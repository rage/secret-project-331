import { useQuery } from "@tanstack/react-query"

import { getUserProgressForCourse } from "../services/backend/courses"

/** Fetches UserCourseProgress for the given course and user. */
export const useUserCourseProgress = (courseId: string, userId: string) => {
  return useQuery({
    queryKey: [`course-${courseId}-progress-${userId}`],
    queryFn: () => getUserProgressForCourse(courseId, userId),
    enabled: !!courseId && !!userId,
  })
}
