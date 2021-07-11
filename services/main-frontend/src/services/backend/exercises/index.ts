import { mainFrontendClient } from "../../mainFrontendClient"
import { Exercise, ExerciseSubmissions } from "../../services.types"

export const fetchExercise = async (exerciseId: string): Promise<Exercise> => {
  const data = (await mainFrontendClient.get(`/exercises/${exerciseId}`, { responseType: "json" }))
    .data
  return data
}

export const fetchExerciseSubmissions = async (
  exerciseId: string,
  _page = 1,
): Promise<ExerciseSubmissions> => {
  const data = (
    await mainFrontendClient.get(`/exercises/${exerciseId}/submissions`, { responseType: "json" })
  ).data
  return data
}
