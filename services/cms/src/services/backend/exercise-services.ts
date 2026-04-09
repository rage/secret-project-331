import { queryOptions } from "@tanstack/react-query"

import { cmsClient } from "./cmsClient"
import { parseCmsResponse } from "./parseCmsResponse"

import { type ExamInstructions, type ExerciseServiceIframeRenderingInfo } from "@/generated/api"
import { z } from "@/generated/api/zod"
import {
  zExamInstructions,
  zExerciseServiceIframeRenderingInfo,
} from "@/generated/api/zod.generated"

export const fetchExamsInstructions = async (examId: string): Promise<ExamInstructions> => {
  const response = await cmsClient.get(`/exams/${examId}/edit`, {
    responseType: "json",
  })
  return parseCmsResponse(response, zExamInstructions)
}

export const getAllExerciseServices = async (): Promise<ExerciseServiceIframeRenderingInfo[]> => {
  const response = await cmsClient.get(`/exercise-services`)
  return parseCmsResponse(response, z.array(zExerciseServiceIframeRenderingInfo))
}

export const getAllExerciseServicesOptions = () =>
  queryOptions({
    queryKey: ["exercise-services"],
    queryFn: getAllExerciseServices,
  })
