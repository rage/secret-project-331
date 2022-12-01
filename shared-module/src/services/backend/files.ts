import axios from "axios"

import { isObjectMap, isString, validateResponse } from "../../utils/fetching"

// Returns a `filename => download-url` map.
export const uploadFromExerciseService = async (
  exerciseServiceSlug: string,
  files: Map<string, string | Blob>,
): Promise<{ [key: string]: string }> => {
  const data = new FormData()
  files.forEach((contents, name) => data.append(name, contents))

  const response = await axios.post(`/api/v0/files/${exerciseServiceSlug}`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return validateResponse(response, isObjectMap(isString))
}
