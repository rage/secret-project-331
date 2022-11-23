import axios from "axios"

import { isString, validateResponse } from "../../utils/fetching"

export const uploadFromExerciseService = async (
  exerciseServiceSlug: string,
  data: unknown,
): Promise<string> => {
  const response = await axios.post(`/api/v0/files/${exerciseServiceSlug}`, data)
  return validateResponse(response, isString)
}
