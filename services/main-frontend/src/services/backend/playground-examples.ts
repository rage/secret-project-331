import axios from "axios"

import { PlaygroundExample, PlaygroundExampleData } from "../../shared-module/bindings"
import { isPlaygroundExample } from "../../shared-module/bindings.guard"
import {
  isArray,
  isObjectMap,
  isString,
  validateResponse,
} from "../../shared-module/utils/fetching"
import { filesClient } from "../filesClient"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchPlaygroundExamples = async (): Promise<Array<PlaygroundExample>> => {
  const response = await mainFrontendClient.get(`/playground_examples`, { responseType: "json" })
  return validateResponse(response, isArray(isPlaygroundExample))
}

export const savePlaygroundExample = async (
  data: PlaygroundExampleData,
): Promise<PlaygroundExample> => {
  const response = await mainFrontendClient.post(`/playground_examples`, data)
  return validateResponse(response, isPlaygroundExample)
}

export const updatePlaygroundExample = async (
  data: PlaygroundExample,
): Promise<PlaygroundExample> => {
  const response = await mainFrontendClient.put(`/playground_examples`, data)
  return validateResponse(response, isPlaygroundExample)
}

export const deletePlaygroundExample = async (id: string): Promise<PlaygroundExample> => {
  const response = await mainFrontendClient.delete(`/playground_examples/${id}`, {
    responseType: "json",
  })
  return validateResponse(response, isPlaygroundExample)
}

export const uploadFilesFromIframe = async (
  files: Map<string, string | Blob>,
): Promise<Map<string, string>> => {
  const form = new FormData()
  files.forEach((val, key) => {
    form.append(key, val)
  })
  const response = await filesClient.post("/playground", form)
  const validated = validateResponse(response, isObjectMap(isString))
  return new Map(Object.entries(validated))
}
