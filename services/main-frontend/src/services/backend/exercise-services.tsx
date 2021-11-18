import { ExerciseService, ExerciseServiceNewOrUpdate } from "../../shared-module/bindings"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchExerciseServices = async (): Promise<[ExerciseService]> => {
  const data = (await mainFrontendClient.get(`/exercise-services/`, { responseType: "json" })).data
  return data
}

export const fetchExerciseServiceById = async (
  exercise_service_id: string,
): Promise<ExerciseService> => {
  const data = (
    await mainFrontendClient.get(`/exercise-services/${exercise_service_id}`, {
      responseType: "json",
    })
  ).data
  return data
}

export const addExerciseService = async (
  exercise_service: ExerciseServiceNewOrUpdate,
): Promise<ExerciseService> => {
  const data = (
    await mainFrontendClient.post("/exercise-services/", exercise_service, {
      responseType: "json",
    })
  ).data
  return data
}

export const deleteExerciseService = async (
  exercise_service_id: string,
): Promise<ExerciseService> => {
  const data = (await mainFrontendClient.delete(`/exercise-services/${exercise_service_id}`)).data
  return data
}

export const updateExerciseService = async (
  exercise_service_id: string,
  exercise_service: ExerciseService,
): Promise<ExerciseService> => {
  const data = (
    await mainFrontendClient.put(`/exercise-services/${exercise_service_id}`, exercise_service, {
      headers: { "Content-Type": "application/json" },
    })
  ).data
  return data
}
