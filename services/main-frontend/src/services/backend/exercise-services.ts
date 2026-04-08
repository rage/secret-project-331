import { queryOptions, UseMutationOptions } from "@tanstack/react-query"

import {
  getExerciseServiceByIdOptions as getExerciseServiceByIdGeneratedOptions,
  getExerciseServicesOptions as getExerciseServicesGeneratedOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  createExerciseService as createExerciseServiceFromApi,
  deleteExerciseService as deleteExerciseServiceFromApi,
  updateExerciseService as updateExerciseServiceFromApi,
} from "@/generated/api/sdk.generated"
import type {
  ExerciseService as GeneratedExerciseService,
  ExerciseServiceWithError as GeneratedExerciseServiceWithError,
} from "@/generated/api/types.generated"
import {
  ExerciseService,
  ExerciseServiceNewOrUpdate,
  ExerciseServiceWithError,
} from "@/shared-module/common/bindings"

const normalizeExerciseService = (exerciseService: GeneratedExerciseService): ExerciseService => ({
  ...exerciseService,
  deleted_at: exerciseService.deleted_at ?? null,
  internal_url: exerciseService.internal_url ?? null,
})

const normalizeExerciseServiceWithError = (
  exerciseServiceWithError: GeneratedExerciseServiceWithError,
): ExerciseServiceWithError => ({
  exercise_service: normalizeExerciseService(exerciseServiceWithError.exercise_service),
  service_info_error: exerciseServiceWithError.service_info_error ?? null,
})

export const getExerciseServicesOptions = () =>
  queryOptions({
    ...getExerciseServicesGeneratedOptions(),
    select: (exerciseServices): ExerciseService[] => exerciseServices.map(normalizeExerciseService),
  })

export const getExerciseServiceByIdOptions = (exerciseServiceId: string) =>
  queryOptions({
    ...getExerciseServiceByIdGeneratedOptions({
      path: {
        exercise_service_id: exerciseServiceId,
      },
    }),
    select: (exerciseService): ExerciseService => normalizeExerciseService(exerciseService),
  })

type CreateExerciseServiceVariables = {
  body: ExerciseServiceNewOrUpdate
}

type UpdateExerciseServiceVariables = {
  path: {
    exercise_service_id: string
  }
  body: ExerciseServiceNewOrUpdate
}

type DeleteExerciseServiceVariables = {
  path: {
    exercise_service_id: string
  }
}

export const createExerciseServiceMutationOptions = (): UseMutationOptions<
  ExerciseServiceWithError,
  unknown,
  CreateExerciseServiceVariables
> => ({
  mutationFn: async ({ body }) => {
    const result = await createExerciseServiceFromApi({
      body,
      throwOnError: true,
    })

    return normalizeExerciseServiceWithError(result)
  },
})

export const deleteExerciseServiceMutationOptions = (): UseMutationOptions<
  ExerciseService,
  unknown,
  DeleteExerciseServiceVariables
> => ({
  mutationFn: async ({ path }) => {
    const deleted = await deleteExerciseServiceFromApi({
      path,
      throwOnError: true,
    })

    return normalizeExerciseService(deleted)
  },
})

export const updateExerciseServiceMutationOptions = (): UseMutationOptions<
  ExerciseServiceWithError,
  unknown,
  UpdateExerciseServiceVariables
> => ({
  mutationFn: async ({ path, body }) => {
    const updated = await updateExerciseServiceFromApi({
      path,
      body,
      throwOnError: true,
    })

    return normalizeExerciseServiceWithError(updated)
  },
})
