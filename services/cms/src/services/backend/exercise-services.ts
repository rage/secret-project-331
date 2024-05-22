import { cmsClient } from "./cmsClient"

import {
  ExamInstructions,
  ExerciseServiceIframeRenderingInfo,
} from "@/shared-module/common/bindings"
import {
  isExamInstructions,
  isExerciseServiceIframeRenderingInfo,
} from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchExamsInstructions = async (examId: string): Promise<ExamInstructions> => {
  const response = await cmsClient.get(`/exams/${examId}/edit`, {
    responseType: "json",
  })
  return validateResponse(response, isExamInstructions)
}

export const getAllExerciseServices = async (): Promise<ExerciseServiceIframeRenderingInfo[]> => {
  const response = await cmsClient.get(`/exercise-services`)
  return validateResponse(response, isArray(isExerciseServiceIframeRenderingInfo))
}
