import { mainFrontendClient } from "../../mainFrontendClient"
import { ExerciseSubmissions } from "../../services.types"

export const fetchExerciseSubmissions = async (
  exerciseId: string,
  _page = 1,
): Promise<ExerciseSubmissions> => {
  const data = (
    await mainFrontendClient.get(`/exercises/${exerciseId}/submissions`, { responseType: "json" })
  ).data
  return data
}
