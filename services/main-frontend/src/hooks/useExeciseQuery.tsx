"use client"

import { queryOptions, useQuery } from "@tanstack/react-query"

import { getExercise } from "@/generated/api/sdk.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const GET_EXERCISE_QUERY_KEY = "getExercise"

const getExerciseQueryOptions = (exerciseId: string | null) =>
  queryOptions({
    queryKey: [GET_EXERCISE_QUERY_KEY, exerciseId] as const,
    queryFn: () =>
      getExercise({
        path: {
          exercise_id: assertNotNullOrUndefined(exerciseId),
        },
      }),
  })

const useExerciseQuery = (exerciseId: string | null) => {
  return useQuery({
    ...getExerciseQueryOptions(exerciseId),
    enabled: !!exerciseId,
  })
}

export default useExerciseQuery
