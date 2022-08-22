import { ExamInstructions, ExerciseService } from "../../shared-module/bindings"
import { isExamInstructions, isExerciseService } from "../../shared-module/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/utils/fetching"

import { cmsClient } from "./cmsClient"

export const fetchExamsInstructions = async (examId: string): Promise<ExamInstructions> => {
  const response = await cmsClient.get(`/exams/${examId}/edit`, {
    responseType: "json",
  })
  return validateResponse(response, isExamInstructions)
}

export const getAllExerciseServices = async (): Promise<ExerciseService[]> => {
  const response = await cmsClient.get(`/exercise-services`)
  return validateResponse(response, isArray(isExerciseService))
}
