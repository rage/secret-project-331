import { useQuery } from "@tanstack/react-query"

import { getAllExerciseStatusSummariesForUserAndCourse } from "../services/backend/courses"

export const useExerciseStatusSummaries = (courseId: string, userId: string) => {
  return useQuery({
    queryKey: ["courses", courseId, "status-for-all-exercises", userId],
    queryFn: () => getAllExerciseStatusSummariesForUserAndCourse(courseId, userId),
  })
}
