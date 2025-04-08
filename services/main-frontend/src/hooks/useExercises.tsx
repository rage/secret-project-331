import { useQuery } from "@tanstack/react-query"

import { fetchExercisesByCourseId } from "@/services/backend/exercises"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useExercises = (courseId: string) => {
  return useQuery({
    queryKey: ["exercises", courseId],
    queryFn: () => fetchExercisesByCourseId(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}
