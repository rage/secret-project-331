import {
  AnswersRequiringAttention,
  NewTeacherGradingDecision,
  UserExerciseState,
} from "../../shared-module/bindings"
import {
  isAnswersRequiringAttention,
  isUserExerciseState,
} from "../../shared-module/bindings.guard"
import { validateResponse } from "../../shared-module/utils/fetching"
import { mainFrontendClient } from "../mainFrontendClient"

export const fetchAnswersRequiringAttention = async (
  exerciseId: string,
  _page = 1,
): Promise<AnswersRequiringAttention> => {
  const response = await mainFrontendClient.get(
    `/exercises/${exerciseId}/answers-requiring-attention`,
    {
      responseType: "json",
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
    {
      headers: { "Content-Type": "application/json" },
    },
  )
  return validateResponse(response, isUserExerciseState)
}
