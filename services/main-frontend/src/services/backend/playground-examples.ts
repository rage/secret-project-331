import { queryOptions } from "@tanstack/react-query"

import { filesClient } from "../filesClient"

import {
  createPlaygroundExampleMutation,
  deletePlaygroundExampleMutation,
  getPlaygroundExamplesOptions as getPlaygroundExamplesGeneratedOptions,
  updatePlaygroundExampleMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  createPlaygroundExample as createPlaygroundExampleFromApi,
  deletePlaygroundExample as deletePlaygroundExampleFromApi,
  getPlaygroundExamples as getPlaygroundExamplesFromApi,
  updatePlaygroundExample as updatePlaygroundExampleFromApi,
} from "@/generated/api/sdk.generated"
import { PlaygroundExample, PlaygroundExampleData } from "@/shared-module/common/bindings"
import { isPlaygroundExample } from "@/shared-module/common/bindings.guard"
import { isArray, isObjectMap, isString } from "@/shared-module/common/utils/fetching"

const validateGeneratedData = <T>(data: unknown, isT: (value: unknown) => value is T): T => {
  if (isT(data)) {
    return data
  }

  throw new Error(`Invalid data from API: ${JSON.stringify(data, undefined, 2)}`)
}

export const fetchPlaygroundExamples = async (): Promise<Array<PlaygroundExample>> => {
  const data = await getPlaygroundExamplesFromApi({
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isPlaygroundExample))
}

export const getPlaygroundExamplesOptions = () =>
  queryOptions({
    ...getPlaygroundExamplesGeneratedOptions(),
    select: (data): PlaygroundExample[] =>
      validateGeneratedData(data, isArray(isPlaygroundExample)),
  })

export const savePlaygroundExample = async (
  data: PlaygroundExampleData,
): Promise<PlaygroundExample> => {
  const response = await createPlaygroundExampleFromApi({
    body: data,
    throwOnError: true,
  })

  return validateGeneratedData(response, isPlaygroundExample)
}

export const savePlaygroundExampleMutationOptions = () => createPlaygroundExampleMutation()

export const updatePlaygroundExample = async (
  data: PlaygroundExample,
): Promise<PlaygroundExample> => {
  const response = await updatePlaygroundExampleFromApi({
    body: data,
    throwOnError: true,
  })

  return validateGeneratedData(response, isPlaygroundExample)
}

export const updatePlaygroundExampleMutationOptions = () => updatePlaygroundExampleMutation()

export const deletePlaygroundExample = async (id: string): Promise<PlaygroundExample> => {
  const response = await deletePlaygroundExampleFromApi({
    path: {
      playground_example_id: id,
    },
    throwOnError: true,
  })

  return validateGeneratedData(response, isPlaygroundExample)
}

export const deletePlaygroundExampleMutationOptions = () => deletePlaygroundExampleMutation()

export const uploadFilesFromIframe = async (
  files: Map<string, string | Blob>,
): Promise<Map<string, string>> => {
  const form = new FormData()
  files.forEach((val, key) => {
    form.append(key, val)
  })
  const response = await filesClient.post("/playground", form)
  const validated = validateGeneratedData(response.data, isObjectMap(isString))
  return new Map(Object.entries(validated))
}
