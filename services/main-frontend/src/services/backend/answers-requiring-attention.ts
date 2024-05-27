import { mainFrontendClient } from "../mainFrontendClient"

import {
  AnswersRequiringAttention,
  NewTeacherGradingDecision,
  UserExerciseState,
} from "@/shared-module/common/bindings"
import {
  isAnswersRequiringAttention,
  isUserExerciseState,
} from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchAnswersRequiringAttention = async (
  exerciseId: string,
  page: number,
  limit: number,
): Promise<AnswersRequiringAttention> => {
  const response = await mainFrontendClient.get(
    `/exercises/${exerciseId}/answers-requiring-attention`,
    {
      params: { page, limit },
    },
  )
  return validateResponse(response, isAnswersRequiringAttention)
}

export const updateAnswerRequiringAttention = async ({
  user_exercise_state_id,
  exercise_id,
  action,
  manual_points,
}: NewTeacherGradingDecision): Promise<UserExerciseState> => {
  const response = await mainFrontendClient.put(
    `/exercise-slide-submissions/update-answer-requiring-attention`,
    { user_exercise_state_id, exercise_id, action, manual_points },
  )
  return validateResponse(response, isUserExerciseState)
}
