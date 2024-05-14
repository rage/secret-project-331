import { useQuery, UseQueryOptions } from "@tanstack/react-query"

import { fetchCourseExercisesAndCountOfAnswersRequiringAttention } from "../services/backend/courses"
import { ExerciseAnswersInCourseRequiringAttentionCount } from "../shared-module/bindings"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"

type OptionsType = Omit<
  UseQueryOptions<Array<ExerciseAnswersInCourseRequiringAttentionCount>>,
  "queryKey" | "queryFn" | "enabled"
>

const useCourseExercisesAndCountAnswersRequitingAttentionQuery = (
  courseId: string | null | undefined,
  options: OptionsType = {},
) => {
  return useQuery({
    queryKey: [`courses-exercises-and-count-of-answers-requiring-attention`, courseId],
    enabled: courseId !== null && courseId !== undefined,
    queryFn: () =>
      fetchCourseExercisesAndCountOfAnswersRequiringAttention(assertNotNullOrUndefined(courseId)),
    ...options,
  })
}

export default useCourseExercisesAndCountAnswersRequitingAttentionQuery
