import { useQuery } from "@tanstack/react-query"

import { fetchExerciseSubmissionsAndUserExerciseStatesWithExerciseId } from "../services/backend/exams"

const useExamSubmissionsInfo = (exercise_id: string, pageNumber: number, pageLimit: number) => {
  return useQuery({
    queryKey: [`/exams/${exercise_id}/submissions`, exercise_id, pageNumber, pageLimit],
    queryFn: () =>
      fetchExerciseSubmissionsAndUserExerciseStatesWithExerciseId(
        exercise_id,
        pageNumber,
        pageLimit,
      ),
  })
}

export default useExamSubmissionsInfo
