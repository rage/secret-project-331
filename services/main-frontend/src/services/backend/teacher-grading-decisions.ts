import { createTeacherGradingDecisionMutation } from "@/generated/api/@tanstack/react-query.generated"
import { createTeacherGradingDecision as createTeacherGradingDecisionFromApi } from "@/generated/api/sdk.generated"
import type { UserExerciseState as GeneratedUserExerciseState } from "@/generated/api/types.generated"
import { NewTeacherGradingDecision, UserExerciseState } from "@/shared-module/common/bindings"

const normalizeUserExerciseState = (
  userExerciseState: GeneratedUserExerciseState,
): UserExerciseState => ({
  ...userExerciseState,
  course_id: userExerciseState.course_id ?? null,
  deleted_at: userExerciseState.deleted_at ?? null,
  exam_id: userExerciseState.exam_id ?? null,
  score_given: userExerciseState.score_given ?? null,
  selected_exercise_slide_id: userExerciseState.selected_exercise_slide_id ?? null,
})

export const createTeacherGradingDecision = async (
  data: NewTeacherGradingDecision,
): Promise<UserExerciseState | null> => {
  const response = await createTeacherGradingDecisionFromApi({
    body: data,
    throwOnError: true,
  })

  if (response === null) {
    return null
  }

  return normalizeUserExerciseState(response)
}

export const createTeacherGradingDecisionMutationOptions = () =>
  createTeacherGradingDecisionMutation()
