import { useQuery } from "@tanstack/react-query"

import { getAllExerciseServices } from "../services/backend/exercise-services"

const useAllExerciseServices = () => {
  return useQuery({ queryKey: ["exercise-services"], queryFn: () => getAllExerciseServices() })
}

export default useAllExerciseServices
