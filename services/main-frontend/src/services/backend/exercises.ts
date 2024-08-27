import { mainFrontendClient } from "../mainFrontendClient"

import { ExerciseSubmissions } from "@/shared-module/common/bindings"
import { isExerciseSubmissions } from "@/shared-module/common/bindings.guard"
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

export interface Block<T> {
  name: string
  isValid: boolean
  clientId: string
  attributes: T
  innerBlocks: Block<unknown>[]
}
