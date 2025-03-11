import { mainFrontendClient } from "../mainFrontendClient"

import { Exercise, ExerciseSubmissions } from "@/shared-module/common/bindings"
import { isExercise, isExerciseSubmissions } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchExerciseSubmissions = async (
  exerciseId: string,
  page: number,
  limit: number,
): Promise<ExerciseSubmissions> => {
  const response = await mainFrontendClient.get(
    `/exercises/${exerciseId}/submissions?page=${page}&limit=${limit}`,
  )
  return validateResponse(response, isExerciseSubmissions)
}

export const getExercise = async (exerciseId: string): Promise<Exercise> => {
  const response = await mainFrontendClient.get(`/exercises/${exerciseId}`)
  return validateResponse(response, isExercise)
}

export interface Block<T> {
  name: string
  isValid: boolean
  clientId: string
  attributes: T
  innerBlocks: Block<unknown>[]
}
