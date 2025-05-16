import { useQuery } from "@tanstack/react-query"

import { getUserProgressForCourseInstance } from "../services/backend/course-instances"

export const useCourseInstanceProgress = (courseInstanceId: string, userId: string) => {
  return useQuery({
    queryKey: [`course-instance-${courseInstanceId}-progress-${userId}`],
    queryFn: () => getUserProgressForCourseInstance(courseInstanceId, userId),
  })
}
