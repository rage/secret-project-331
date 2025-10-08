import { mainFrontendClient } from "../mainFrontendClient"

import { NewTeacherGradingDecision, UserExerciseState } from "@/shared-module/common/bindings"
import { isUserExerciseState } from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const createTeacherGradingDecision = async (
  data: NewTeacherGradingDecision,
): Promise<UserExerciseState | null> => {
  const response = await mainFrontendClient.post(`/teacher-grading-decisions`, data)

  if (response.status === 204) {
    return null
  }

  return validateResponse(response, isUserExerciseState)
}
