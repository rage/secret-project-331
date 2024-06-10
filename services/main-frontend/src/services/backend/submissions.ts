import { mainFrontendClient } from "../mainFrontendClient"

import {
  ExerciseSlideSubmissionInfo,
  NewTeacherGradingDecision,
  TeacherGradingDecision,
  UserExerciseState,
} from "@/shared-module/common/bindings"
import {
  isExerciseSlideSubmissionInfo,
  isTeacherGradingDecision,
  isUserExerciseState,
} from "@/shared-module/common/bindings.guard"
import { validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchSubmissionInfo = async (
  submissionId: string,
): Promise<ExerciseSlideSubmissionInfo> => {
  const response = await mainFrontendClient.get(`/exercise-slide-submissions/${submissionId}/info`)
  return validateResponse(response, isExerciseSlideSubmissionInfo)
}

export const addTeacherGrading = async (
  data: NewTeacherGradingDecision,
): Promise<TeacherGradingDecision> => {
  const response = await mainFrontendClient.put(`/exercise-slide-submissions/add-teacher-grading`, {
    ...data,
  })
  return validateResponse(response, isTeacherGradingDecision)
}

export interface GradingInfo {
  examId: string
  exerciseId: string
  userId: string
}

export const fetchGradingInfo = async (
  examId: string,
  exerciseId: string,
  userId: string,
): Promise<UserExerciseState> => {
  const response = await mainFrontendClient.get(
    `/exercise-slide-submissions/${examId}/user-exercise-state-info?exercise_id=${exerciseId}&user_id=${userId}`,
  )
  return validateResponse(response, isUserExerciseState)
}
