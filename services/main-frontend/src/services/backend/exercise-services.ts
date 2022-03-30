import { ExerciseService, ExerciseServiceNewOrUpdate } from "../../shared-module/bindings"
import { isExerciseService } from "../../shared-module/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchExerciseServices = async (): Promise<Array<ExerciseService>> => {
  const response = await mainFrontendClient.get(`/exercise-services/`, { responseType: "json" })
  return validateResponse(response, isArray(isExerciseService))
}

export const fetchExerciseServiceById = async (
  exercise_service_id: string,
): Promise<ExerciseService> => {
  const response = await mainFrontendClient.get(`/exercise-services/${exercise_service_id}`, {
    responseType: "json",
  })
  return validateResponse(response, isExerciseService)
}

export const addExerciseService = async (
  exercise_service: ExerciseServiceNewOrUpdate,
): Promise<ExerciseService> => {
  const response = await mainFrontendClient.post("/exercise-services/", exercise_service, {
    responseType: "json",
  })
  return validateResponse(response, isExerciseService)
}

export const deleteExerciseService = async (
  exercise_service_id: string,
): Promise<ExerciseService> => {
  const response = await mainFrontendClient.delete(`/exercise-services/${exercise_service_id}`)
  return validateResponse(response, isExerciseService)
}

export const updateExerciseService = async (
  exercise_service_id: string,
  exercise_service: ExerciseService,
): Promise<ExerciseService> => {
  const response = await mainFrontendClient.put(
    `/exercise-services/${exercise_service_id}`,
    exercise_service,
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  return validateResponse(response, isExerciseService)
}
