import { mainFrontendClient } from "../mainFrontendClient"

import { Exercise, ExerciseSubmissions } from "@/shared-module/common/bindings"
import { isExercise, isExerciseSubmissions } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchExerciseSubmissions = async (
  exerciseId: string,
  page: number,
  limit: number,
): Promise<ExerciseSubmissions> => {
  const response = await mainFrontendClient.get(
    `/exercises/${exerciseId}/submissions?page=${page}&limit=${limit}`,
  )
  return validateResponse(response, isExerciseSubmissions)
}

export interface Block<T> {
  name: string
  isValid: boolean
  clientId: string
  attributes: T
  innerBlocks: Block<unknown>[]
}

export const fetchExercisesByCourseId = async (courseId: string): Promise<Exercise[]> => {
  const response = await mainFrontendClient.get(`/exercises/${courseId}/exercises-by-course-id`)
  return validateResponse(response, isArray(isExercise))
}

export const resetExercisesForUsers = async (
  courseId: string,
  userIds: string[],
  exerciseIds: string[],
  threshold: number | null,
  resetAllBelowMaxPoints: boolean,
  resetOnlyLockedPeerReviews: boolean,
): Promise<number> => {
  const response = await mainFrontendClient.post(
    `/exercises/${courseId}/reset-exercises-for-selected-users`,
    {
      user_ids: userIds,
      exercise_ids: exerciseIds,
      threshold: threshold,
      reset_all_below_max_points: resetAllBelowMaxPoints,
      reset_only_locked_peer_reviews: resetOnlyLockedPeerReviews,
    },
  )

  return response.data
}
