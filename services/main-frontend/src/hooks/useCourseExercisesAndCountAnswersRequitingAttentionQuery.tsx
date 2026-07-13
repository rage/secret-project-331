"use client"

import type { UseQueryOptions } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"

import { getCourseExercisesAndAnswersRequiringAttentionCountsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { ExerciseAnswersInCourseRequiringAttentionCount } from "@/generated/api/types.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

type OptionsType = Omit<
  UseQueryOptions<ExerciseAnswersInCourseRequiringAttentionCount[]>,
  "queryKey" | "queryFn" | "enabled"
>

const useCourseExercisesAndCountAnswersRequitingAttentionQuery = (
  courseId: string | null | undefined,
  options: OptionsType = {},
) => {
  const generatedOptions = optionalGeneratedQueryOptions({
    value: courseId,
    isReady: (value): value is string => Boolean(value),
    build: (value) =>
      getCourseExercisesAndAnswersRequiringAttentionCountsOptions({
        path: {
          course_id: value,
        },
      }),
  })

  return useQuery({
    ...(generatedOptions as UseQueryOptions<
      ExerciseAnswersInCourseRequiringAttentionCount[],
      Error,
      ExerciseAnswersInCourseRequiringAttentionCount[]
    >),
    ...options,
  })
}

export default useCourseExercisesAndCountAnswersRequitingAttentionQuery
