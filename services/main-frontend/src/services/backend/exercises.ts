import { queryOptions } from "@tanstack/react-query"

import { downloadTextFile } from "./downloads"
import { validateGeneratedData } from "./generated"

import {
  getExerciseAnswersRequiringAttentionOptions as getExerciseAnswersRequiringAttentionGeneratedOptions,
  getExerciseCsvExportTaskOptionsOptions as getExerciseCsvExportTaskOptionsGeneratedOptions,
  getExerciseOptions as getExerciseGeneratedOptions,
  getExercisesByCourseIdOptions as getExercisesByCourseIdGeneratedOptions,
  getExerciseSubmissionsForUserOptions as getExerciseSubmissionsForUserGeneratedOptions,
  getExerciseSubmissionsOptions as getExerciseSubmissionsGeneratedOptions,
  resetExercisesForSelectedUsersMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  exportExerciseAnswersCsv,
  exportExerciseDefinitionsCsv,
  getExerciseAnswersRequiringAttention as getExerciseAnswersRequiringAttentionFromApi,
  getExerciseCsvExportTaskOptions as getExerciseCsvExportTaskOptionsFromApi,
  getExercise as getExerciseFromApi,
  getExercisesByCourseId as getExercisesByCourseIdFromApi,
  getExerciseSubmissionsForUser as getExerciseSubmissionsForUserFromApi,
  getExerciseSubmissions as getExerciseSubmissionsFromApi,
  resetExercisesForSelectedUsers,
} from "@/generated/api/sdk.generated"
import {
  AnswersRequiringAttention,
  Exercise,
  ExerciseCsvExportTaskOption,
  ExerciseSlideSubmission,
  ExerciseSubmissions,
} from "@/shared-module/common/bindings"
import {
  isAnswersRequiringAttention,
  isExercise,
  isExerciseCsvExportTaskOption,
  isExerciseSlideSubmission,
  isExerciseSubmissions,
} from "@/shared-module/common/bindings.guard"
import { isArray, isNumber } from "@/shared-module/common/utils/fetching"

export type { ExerciseCsvExportTaskOption }

export const fetchExerciseSubmissions = async (
  exerciseId: string,
  page: number,
  limit: number,
): Promise<ExerciseSubmissions> => {
  const data = await getExerciseSubmissionsFromApi({
    path: {
      exercise_id: exerciseId,
    },
    query: {
      page,
      limit,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isExerciseSubmissions)
}

export const getExerciseSubmissionsOptions = (exerciseId: string, page: number, limit: number) =>
  queryOptions({
    ...getExerciseSubmissionsGeneratedOptions({
      path: {
        exercise_id: exerciseId,
      },
      query: {
        page,
        limit,
      },
    }),
    select: (data): ExerciseSubmissions => validateGeneratedData(data, isExerciseSubmissions),
  })

export const getExercise = async (exerciseId: string): Promise<Exercise> => {
  const data = await getExerciseFromApi({
    path: {
      exercise_id: exerciseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isExercise)
}

export const getExerciseOptions = (exerciseId: string) =>
  queryOptions({
    ...getExerciseGeneratedOptions({
      path: {
        exercise_id: exerciseId,
      },
    }),
    select: (data): Exercise => validateGeneratedData(data, isExercise),
  })

export interface Block<T> {
  name: string
  isValid: boolean
  clientId: string
  attributes: T
  innerBlocks: Block<unknown>[]
}

export const fetchExercisesByCourseId = async (courseId: string): Promise<Exercise[]> => {
  const data = await getExercisesByCourseIdFromApi({
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isExercise))
}

export const getExercisesByCourseIdOptions = (courseId: string) =>
  queryOptions({
    ...getExercisesByCourseIdGeneratedOptions({
      path: {
        course_id: courseId,
      },
    }),
    select: (data): Exercise[] => validateGeneratedData(data, isArray(isExercise)),
  })

export const fetchExerciseCsvExportTaskOptions = async (
  exerciseId: string,
): Promise<ExerciseCsvExportTaskOption[]> => {
  const data = await getExerciseCsvExportTaskOptionsFromApi({
    path: {
      exercise_id: exerciseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isExerciseCsvExportTaskOption))
}

export const getExerciseCsvExportTaskOptions = (exerciseId: string) =>
  queryOptions({
    ...getExerciseCsvExportTaskOptionsGeneratedOptions({
      path: {
        exercise_id: exerciseId,
      },
    }),
    select: (data): ExerciseCsvExportTaskOption[] =>
      validateGeneratedData(data, isArray(isExerciseCsvExportTaskOption)),
  })

export const downloadExerciseDefinitionsCsv = async (
  exerciseId: string,
  exerciseTaskId: string,
): Promise<void> => {
  const csv = await exportExerciseDefinitionsCsv({
    path: {
      exercise_id: exerciseId,
    },
    query: {
      exercise_task_id: exerciseTaskId,
    },
    throwOnError: true,
  })

  downloadTextFile(csv, `exercise-${exerciseId}-definitions-${exerciseTaskId}.csv`)
}

export const downloadExerciseAnswersCsv = async (
  exerciseId: string,
  exerciseTaskId: string,
  onlyLatestPerUser = false,
): Promise<void> => {
  const csv = await exportExerciseAnswersCsv({
    path: {
      exercise_id: exerciseId,
    },
    query: {
      exercise_task_id: exerciseTaskId,
      only_latest_per_user: onlyLatestPerUser || undefined,
    },
    throwOnError: true,
  })

  downloadTextFile(csv, `exercise-${exerciseId}-answers-${exerciseTaskId}.csv`)
}

export const fetchExerciseSubmissionsForUser = async (
  exerciseId: string,
  userId: string,
): Promise<ExerciseSlideSubmission[]> => {
  const data = await getExerciseSubmissionsForUserFromApi({
    path: {
      exercise_id: exerciseId,
      user_id: userId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isArray(isExerciseSlideSubmission))
}

export const getExerciseSubmissionsForUserOptions = (exerciseId: string, userId: string) =>
  queryOptions({
    ...getExerciseSubmissionsForUserGeneratedOptions({
      path: {
        exercise_id: exerciseId,
        user_id: userId,
      },
    }),
    select: (data): ExerciseSlideSubmission[] =>
      validateGeneratedData(data, isArray(isExerciseSlideSubmission)),
  })

export const fetchAnswersRequiringAttention = async (
  exerciseId: string,
  page: number,
  limit: number,
): Promise<AnswersRequiringAttention> => {
  const data = await getExerciseAnswersRequiringAttentionFromApi({
    path: {
      exercise_id: exerciseId,
    },
    query: {
      page,
      limit,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isAnswersRequiringAttention)
}

export const getExerciseAnswersRequiringAttentionOptions = (
  exerciseId: string,
  page: number,
  limit: number,
) =>
  queryOptions({
    ...getExerciseAnswersRequiringAttentionGeneratedOptions({
      path: {
        exercise_id: exerciseId,
      },
      query: {
        page,
        limit,
      },
    }),
    select: (data): AnswersRequiringAttention =>
      validateGeneratedData(data, isAnswersRequiringAttention),
  })

export const resetExercisesForUsers = async (
  courseId: string,
  userIds: string[],
  exerciseIds: string[],
  threshold: number | null,
  resetAllBelowMaxPoints: boolean,
  resetOnlyLockedPeerReviews: boolean,
): Promise<number> => {
  const data = await resetExercisesForSelectedUsers({
    body: {
      user_ids: userIds,
      exercise_ids: exerciseIds,
      threshold,
      reset_all_below_max_points: resetAllBelowMaxPoints,
      reset_only_locked_peer_reviews: resetOnlyLockedPeerReviews,
    },
    path: {
      course_id: courseId,
    },
    throwOnError: true,
  })

  return validateGeneratedData(data, isNumber)
}

export const resetExercisesForSelectedUsersMutationOptions = () =>
  resetExercisesForSelectedUsersMutation()
