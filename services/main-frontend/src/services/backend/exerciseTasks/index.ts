import { mainFrontendClient } from "../../mainFrontendClient"
import { ExerciseTask } from "../../services.types"

export const fetchExerciseTask = async (exerciseTaskId: string): Promise<ExerciseTask> => {
  const data = (
    await mainFrontendClient.get(`/exercise_tasks/${exerciseTaskId}`, { responseType: "json" })
  ).data
  return data
}
