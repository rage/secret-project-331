import { useQuery } from "@tanstack/react-query"

import { getAllExerciseServices } from "../services/backend/exercise-services"

const useAllExerciseServices = () => {
  return useQuery(["exercise-services"], () => getAllExerciseServices())
}

export default useAllExerciseServices
