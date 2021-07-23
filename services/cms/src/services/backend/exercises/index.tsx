import { Exercise } from "../../../shared-module/bindings"
import { cmsClient } from "../cmsClient"

export const getExerciseById = async (id: string): Promise<Exercise> => {
  const data = (await cmsClient.get(`/exercises/${id}`, { responseType: "json" })).data
  return data
}
