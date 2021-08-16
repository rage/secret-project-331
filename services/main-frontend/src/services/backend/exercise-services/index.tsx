import { ExerciseService } from "../../../shared-module/bindings"
import { mainFrontendClient } from "../../mainFrontendClient"

export const fetchExerciseServices = async (): Promise<[ExerciseService]> => {
  const data = (await mainFrontendClient.get(`/exercise-services/`, { responseType: "json" })).data
  return data
}
