import { PlaygroundExample, PlaygroundExampleData } from "../../../shared-module/bindings"
import { mainFrontendClient } from "../../mainFrontendClient"

export const fetchPlaygroundExamples = async (): Promise<PlaygroundExample[]> => {
  return (await mainFrontendClient.get(`/playground_examples`, { responseType: "json" })).data
}

export const savePlaygroundExample = async (
  data: PlaygroundExampleData,
): Promise<PlaygroundExample> => {
  return (await mainFrontendClient.post(`/playground_examples`, data)).data
}

export const deletePlaygroundExample = async (id: string): Promise<PlaygroundExample> => {
  return (
    await mainFrontendClient.delete(`/playground_examples/${id}`, {
      responseType: "json",
    })
  ).data
}
