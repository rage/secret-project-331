import { useQuery } from "@tanstack/react-query"

import { getUserProgressForCourse } from "../services/backend/courses"

export const useCourseInstanceProgress = (courseId: string, userId: string) => {
  return useQuery({
    queryKey: [`course-${courseId}-progress-${userId}`],
    queryFn: () => getUserProgressForCourse(courseId, userId),
  })
}
