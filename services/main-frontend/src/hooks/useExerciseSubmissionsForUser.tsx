"use client"

import { queryOptions, useQuery } from "@tanstack/react-query"

import { getExerciseSubmissionsForUser } from "@/generated/api/sdk.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const GET_EXERCISE_SUBMISSIONS_FOR_USER_QUERY_KEY = "getExerciseSubmissionsForUser"

const getExerciseSubmissionsForUserQueryOptions = (exerciseId: string, userId: string) =>
  queryOptions({
    queryKey: [GET_EXERCISE_SUBMISSIONS_FOR_USER_QUERY_KEY, exerciseId, userId] as const,
    queryFn: () =>
      getExerciseSubmissionsForUser({
        path: {
          exercise_id: exerciseId,
          user_id: userId,
        },
      }),
  })

export const useExerciseSubmissionsForUser = (
  exerciseId: string | null | undefined,
  userId: string | null | undefined,
) => {
  return useQuery(
    optionalGeneratedQueryOptions({
      value: exerciseId && userId ? { exerciseId, userId } : null,
      isReady: (
        value,
      ): value is {
        exerciseId: string
        userId: string
      } => Boolean(value?.exerciseId && value?.userId),
      build: ({ exerciseId, userId }) =>
        getExerciseSubmissionsForUserQueryOptions(exerciseId, userId),
    }),
  )
}
