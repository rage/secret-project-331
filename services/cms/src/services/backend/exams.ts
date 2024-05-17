import { ExamInstructions, ExamInstructionsUpdate } from "../../shared-module/bindings"
import { isExamInstructions } from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"

import { cmsClient } from "./cmsClient"

export const fetchExamsInstructions = async (examId: string): Promise<ExamInstructions> => {
  const response = await cmsClient.get(`/exams/${examId}/edit`, {
    responseType: "json",
  })
  return validateResponse(response, isExamInstructions)
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
  return validateResponse(response, isExamInstructions)
}
