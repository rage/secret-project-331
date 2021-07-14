import { mainFrontendClient } from "../../mainFrontendClient"
import { ExerciseService } from "../../services.types"

export const fetchExerciseService = async (exerciseType: string): Promise<ExerciseService> => {
  const data = (
    await mainFrontendClient.get(`/exercise_services/${exerciseType}`, { responseType: "json" })
  ).data
  return data
}
