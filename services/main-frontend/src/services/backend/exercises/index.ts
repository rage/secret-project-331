import { ExerciseSubmissions } from "../../../shared-module/bindings"
import { mainFrontendClient } from "../../mainFrontendClient"

export const fetchExerciseSubmissions = async (
  exerciseId: string,
  _page = 1,
): Promise<ExerciseSubmissions> => {
  const data = (
    await mainFrontendClient.get(`/exercises/${exerciseId}/submissions`, { responseType: "json" })
  ).data
  return data
}
