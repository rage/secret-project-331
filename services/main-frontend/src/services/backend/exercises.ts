import { mainFrontendClient } from "../mainFrontendClient"

import {
  Exercise,
  ExerciseCsvExportTaskOption,
  ExerciseSlideSubmission,
  ExerciseSubmissions,
} from "@/shared-module/common/bindings"
import {
  isExercise,
  isExerciseCsvExportTaskOption,
  isExerciseSlideSubmission,
  isExerciseSubmissions,
} from "@/shared-module/common/bindings.guard"
import { isArray, isNumber, validateResponse } from "@/shared-module/common/utils/fetching"

export type { ExerciseCsvExportTaskOption }

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

export interface DownloadedCsvFile {
  blob: Blob
  fileName: string
}

export const fetchExercisesByCourseId = async (courseId: string): Promise<Exercise[]> => {
  const response = await mainFrontendClient.get(`/exercises/${courseId}/exercises-by-course-id`)
  return validateResponse(response, isArray(isExercise))
}

export const fetchExerciseCsvExportTaskOptions = async (
  exerciseId: string,
): Promise<ExerciseCsvExportTaskOption[]> => {
  const response = await mainFrontendClient.get(`/exercises/${exerciseId}/csv-export-task-options`)
  return validateResponse(response, isArray(isExerciseCsvExportTaskOption))
}

export const downloadExerciseDefinitionsCsv = async (
  exerciseId: string,
  exerciseTaskId: string,
): Promise<DownloadedCsvFile> => {
  const response = await mainFrontendClient.get(
    `/exercises/${exerciseId}/export-definitions-csv?exercise_task_id=${exerciseTaskId}`,
    { responseType: "blob" },
  )
  return {
    blob: response.data,
    fileName: `exercise-${exerciseId}-definitions-${exerciseTaskId}.csv`,
  }
}

export const downloadExerciseAnswersCsv = async (
  exerciseId: string,
  exerciseTaskId: string,
): Promise<DownloadedCsvFile> => {
  const response = await mainFrontendClient.get(
    `/exercises/${exerciseId}/export-answers-csv?exercise_task_id=${exerciseTaskId}`,
    { responseType: "blob" },
  )
  return {
    blob: response.data,
    fileName: `exercise-${exerciseId}-answers-${exerciseTaskId}.csv`,
  }
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
