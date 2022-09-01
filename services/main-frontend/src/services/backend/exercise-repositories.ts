/* eslint-disable i18next/no-literal-string */

import { ExerciseRepository, NewExerciseRepository } from "../../shared-module/bindings"
import { isExerciseRepository } from "../../shared-module/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const addExerciseRepository = async (
  courseId: string | null,
  examId: string | null,
  gitUrl: string,
  deployKey: string,
): Promise<void> => {
  const data: NewExerciseRepository = {
    course_id: courseId,
    exam_id: examId,
    git_url: gitUrl,
    deploy_key: deployKey.length > 0 ? deployKey : null,
  }
  return mainFrontendClient.post(`/exercise-repositories/new`, data, { responseType: "json" })
}

export const editExerciseRepository = async (id: string, gitUrl: string): Promise<void> => {
  const data: unknown = { url: gitUrl }
  return mainFrontendClient.put(`/exercise-repositories/${id}`, data, { responseType: "json" })
}

export const getExerciseRepositories = async (
  courseId: string | null,
  examId: string | null,
): Promise<ExerciseRepository[]> => {
  let url
  if (courseId) {
    url = `/exercise-repositories/course/${courseId}`
  } else if (examId) {
    url = `/exercise-repositories/exam/${examId}`
  } else {
    throw "No course or exam id given"
  }
  const res = await mainFrontendClient.get(url, {
    responseType: "json",
  })
  return validateResponse(res, isArray(isExerciseRepository))
}

export const deleteExerciseRepository = async (id: string): Promise<void> => {
  await mainFrontendClient.delete(`/exercise-repositories/${id}`, { responseType: "json" })
}
