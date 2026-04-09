"use client"

import { queryOptions, useQuery, UseQueryOptions } from "@tanstack/react-query"

import { getCourseExercisesAndAnswersRequiringAttentionCounts as getCourseExercisesAndAnswersRequiringAttentionCountsFromApi } from "@/generated/api/sdk.generated"
import type { ExerciseAnswersInCourseRequiringAttentionCount } from "@/generated/api/types.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

type OptionsType = Omit<
  UseQueryOptions<Array<ExerciseAnswersInCourseRequiringAttentionCount>>,
  "queryKey" | "queryFn" | "enabled"
>

const GET_COURSE_EXERCISES_AND_ANSWERS_REQUIRING_ATTENTION_COUNTS_QUERY_KEY =
  "getCourseExercisesAndAnswersRequiringAttentionCounts"

const getCourseExercisesAndAnswersRequiringAttentionCountsQueryOptions = (
  courseId: string | null | undefined,
) =>
  queryOptions({
    queryKey: [
      {
        _id: GET_COURSE_EXERCISES_AND_ANSWERS_REQUIRING_ATTENTION_COUNTS_QUERY_KEY,
        path: { course_id: courseId },
      },
    ] as const,
    queryFn: async () =>
      getCourseExercisesAndAnswersRequiringAttentionCountsFromApi({
        path: {
          course_id: assertNotNullOrUndefined(courseId),
        },
      }),
  })

const useCourseExercisesAndCountAnswersRequitingAttentionQuery = (
  courseId: string | null | undefined,
  options: OptionsType = {},
) => {
  const generatedOptions =
    getCourseExercisesAndAnswersRequiringAttentionCountsQueryOptions(courseId)

  return useQuery({
    ...(generatedOptions as UseQueryOptions<
      ExerciseAnswersInCourseRequiringAttentionCount[],
      Error,
      ExerciseAnswersInCourseRequiringAttentionCount[]
    >),
    enabled: courseId !== null && courseId !== undefined,
    ...options,
  })
}

export default useCourseExercisesAndCountAnswersRequitingAttentionQuery
