"use client"

import { useQuery } from "@tanstack/react-query"

import { getExerciseOptions } from "@/generated/api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const useExerciseQuery = (exerciseId: string | null) => {
  return useQuery(
    optionalGeneratedQueryOptions({
      value: exerciseId,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getExerciseOptions({
          path: {
            exercise_id: value,
          },
        }),
    }),
  )
}

export default useExerciseQuery
