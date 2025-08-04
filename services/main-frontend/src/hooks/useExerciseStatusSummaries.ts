import { useQuery } from "@tanstack/react-query"

import { getAllExerciseStatusSummariesForUserAndCourseInstance } from "../services/backend/course-instances"

export const useExerciseStatusSummaries = (courseInstanceId: string, userId: string) => {
  return useQuery({
    queryKey: [`${courseInstanceId}-status-for-all-exercises-${userId}`],
    queryFn: () => getAllExerciseStatusSummariesForUserAndCourseInstance(courseInstanceId, userId),
  })
}
