import { ExamInstructions, ExamInstructionsUpdate } from "../../shared-module/common/bindings"
import { isExamInstructions } from "../../shared-module/common/bindings.guard"
import { validateResponse } from "../../shared-module/common/utils/fetching"

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
