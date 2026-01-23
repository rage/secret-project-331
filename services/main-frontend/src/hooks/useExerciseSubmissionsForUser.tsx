"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchExerciseSubmissionsForUser } from "../services/backend/exercises"

import { ExerciseSlideSubmission } from "@/shared-module/common/bindings"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useExerciseSubmissionsForUser = (
  exerciseId: string | null | undefined,
  userId: string | null | undefined,
) => {
  return useQuery<ExerciseSlideSubmission[]>({
    queryKey: ["exercise-submissions-for-user", exerciseId, userId],
    queryFn: () =>
      fetchExerciseSubmissionsForUser(
        assertNotNullOrUndefined(exerciseId),
        assertNotNullOrUndefined(userId),
      ),
    enabled: !!exerciseId && !!userId,
  })
}
