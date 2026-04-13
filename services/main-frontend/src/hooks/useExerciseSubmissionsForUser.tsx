"use client"

import { useQuery } from "@tanstack/react-query"

import { getExerciseSubmissionsForUserOptions } from "@/generated/api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

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
        getExerciseSubmissionsForUserOptions({
          path: {
            exercise_id: exerciseId,
            user_id: userId,
          },
        }),
    }),
  )
}
