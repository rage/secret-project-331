import { ExerciseSubmissions } from "../../shared-module/bindings"
import { isExerciseSubmissions } from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchExerciseSubmissions = async (
  exerciseId: string,
  _page = 1,
): Promise<ExerciseSubmissions> => {
  const response = await mainFrontendClient.get(`/exercises/${exerciseId}/submissions`, {
    responseType: "json",
  })
  return validateResponse(response, isExerciseSubmissions)
}
