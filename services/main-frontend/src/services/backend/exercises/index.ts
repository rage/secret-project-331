import {
  ExerciseSubmissions,
  PlaygroundExample,
  PlaygroundExampleData,
} from "../../../shared-module/bindings"
import { mainFrontendClient } from "../../mainFrontendClient"

export const fetchExerciseSubmissions = async (
  exerciseId: string,
  _page = 1,
): Promise<ExerciseSubmissions> => {
  const data = (
    await mainFrontendClient.get(`/exercises/${exerciseId}/submissions`, { responseType: "json" })
  ).data
  return data
}

export const fetchPlaygroundExamples = async (): Promise<PlaygroundExample[]> => {
  return (await mainFrontendClient.get(`/exercises/playground-examples`, { responseType: "json" }))
    .data
}

export const savePlaygroundExample = async (
  data: PlaygroundExampleData,
): Promise<PlaygroundExample> => {
  return (await mainFrontendClient.post(`/exercises/playground-examples`, data)).data
}

export const deletePlaygroundExample = async (id: string): Promise<PlaygroundExample> => {
  return (
    await mainFrontendClient.delete(`/exercises/playground-examples/${id}`, {
      responseType: "json",
    })
  ).data
}
