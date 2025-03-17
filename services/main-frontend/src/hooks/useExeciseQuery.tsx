import { useQuery } from "@tanstack/react-query"

import { getExercise } from "../services/backend/exercises"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const useExerciseQuery = (exerciseId: string | null) => {
  return useQuery({
    queryKey: [`exercise-${exerciseId}`],
    queryFn: () => getExercise(assertNotNullOrUndefined(exerciseId)),
    enabled: exerciseId !== null,
  })
}

export default useExerciseQuery
