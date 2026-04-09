"use client"

import { queryOptions, useQuery } from "@tanstack/react-query"

import { getExerciseSubmissionsForUser } from "@/generated/api/sdk.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const GET_EXERCISE_SUBMISSIONS_FOR_USER_QUERY_KEY = "getExerciseSubmissionsForUser"

const getExerciseSubmissionsForUserQueryOptions = (
  exerciseId: string | null | undefined,
  userId: string | null | undefined,
) =>
  queryOptions({
    queryKey: [GET_EXERCISE_SUBMISSIONS_FOR_USER_QUERY_KEY, exerciseId, userId] as const,
    queryFn: () =>
      getExerciseSubmissionsForUser({
        path: {
          exercise_id: assertNotNullOrUndefined(exerciseId),
          user_id: assertNotNullOrUndefined(userId),
        },
      }),
  })

export const useExerciseSubmissionsForUser = (
  exerciseId: string | null | undefined,
  userId: string | null | undefined,
) => {
  return useQuery({
    ...getExerciseSubmissionsForUserQueryOptions(exerciseId, userId),
    enabled: !!exerciseId && !!userId,
  })
}
