import { cmsClient } from "./cmsClient"
import { parseCmsResponse } from "./parseCmsResponse"

import { type ExamInstructions, type ExamInstructionsUpdate } from "@/generated/api"
import { zExamInstructions } from "@/generated/api/zod.generated"

export const fetchExamsInstructions = async (examId: string): Promise<ExamInstructions> => {
  const response = await cmsClient.get(`/exams/${examId}/edit`, {
    responseType: "json",
  })
  return parseCmsResponse(response, zExamInstructions)
}

export const updateExamsInstructions = async (
  id: string,
  { instructions }: ExamInstructionsUpdate,
): Promise<ExamInstructions> => {
  const response = await cmsClient.put(
    `/exams/${id}/edit`,
    { instructions },
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  return parseCmsResponse(response, zExamInstructions)
}
