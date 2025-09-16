import { isNumber } from "lodash"

import { mainFrontendClient } from "../mainFrontendClient"

import {
  Exercise,
  ExerciseSlideSubmission,
  ExerciseSubmissions,
} from "@/shared-module/common/bindings"
import {
  isExercise,
  isExerciseSlideSubmission,
  isExerciseSubmissions,
} from "@/shared-module/common/bindings.guard"
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

export const getExercise = async (exerciseId: string): Promise<Exercise> => {
  const response = await mainFrontendClient.get(`/exercises/${exerciseId}`)
  return validateResponse(response, isExercise)
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

export const fetchExerciseSubmissionsForUser = async (
  exerciseId: string,
  userId: string,
): Promise<ExerciseSlideSubmission[]> => {
  const response = await mainFrontendClient.get(
    `/exercises/${exerciseId}/submissions/user/${userId}`,
  )
  return validateResponse(response, isArray(isExerciseSlideSubmission))
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

  return validateResponse(response, isNumber)
}
