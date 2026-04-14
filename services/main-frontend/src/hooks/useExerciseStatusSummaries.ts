import { useQuery } from "@tanstack/react-query"

import { getCourseExerciseStatusesForUserOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useExerciseStatusSummaries = (courseId: string, userId: string) => {
  return useQuery({
    ...getCourseExerciseStatusesForUserOptions({
      path: {
        course_id: courseId,
        user_id: userId,
      },
    }),
  })
}
