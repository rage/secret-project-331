import { useQuery } from "@tanstack/react-query"

import { fetchExerciseById } from "../services/backend"

const useCourseMaterialExerciseQuery = (exerciseId: string, showExercise: boolean) => {
  const getCourseMaterialExercise = useQuery({
    queryKey: courseMaterialExerciseQueryKey(exerciseId),
    queryFn: () => fetchExerciseById(exerciseId),
    enabled: showExercise,
  })
  return getCourseMaterialExercise
}

export const courseMaterialExerciseQueryKey = (id: string) => [`course-material-exercise`, id]

export default useCourseMaterialExerciseQuery
