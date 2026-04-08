"use client"

import { useQuery } from "@tanstack/react-query"

import { getExerciseOptions } from "../services/backend/exercises"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const useExerciseQuery = (exerciseId: string | null) => {
  return useQuery({
    ...getExerciseOptions(assertNotNullOrUndefined(exerciseId)),
    enabled: exerciseId !== null,
  })
}

export default useExerciseQuery
