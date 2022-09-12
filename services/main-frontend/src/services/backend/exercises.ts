import { ExerciseSubmissions } from "../../shared-module/bindings"
import { isExerciseSubmissions } from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchExerciseSubmissions = async (
  exerciseId: string,
  page: number,
  limit: number,
): Promise<ExerciseSubmissions> => {
  const response = await mainFrontendClient.get(
    `/exercises/${exerciseId}/submissions?page=${page}&limit=${limit}`,
    {
      responseType: "json",
    },
  )
  return validateResponse(response, isExerciseSubmissions)
}
