import { useQuery } from "@tanstack/react-query"

import { getCourseExerciseStatusesForUserOptions } from "../services/backend/courses"

export const useExerciseStatusSummaries = (courseId: string, userId: string) => {
  return useQuery(getCourseExerciseStatusesForUserOptions(courseId, userId))
}
