import { mainFrontendClient } from "../../mainFrontendClient"
import { ExerciseServiceInfo } from "../../services.types"

export const fetchExerciseServiceInfo = async (url: string): Promise<ExerciseServiceInfo> => {
  const data = (await mainFrontendClient.get(url, { responseType: "json" })).data
  return data
}
