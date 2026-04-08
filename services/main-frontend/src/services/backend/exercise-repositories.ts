import { queryOptions } from "@tanstack/react-query"

import {
  createExerciseRepositoryMutation,
  deleteExerciseRepositoryMutation,
  updateExerciseRepositoryMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import {
  createExerciseRepository as createExerciseRepositoryFromApi,
  deleteExerciseRepository as deleteExerciseRepositoryFromApi,
  getExerciseRepositoriesForCourse as getExerciseRepositoriesForCourseFromApi,
  getExerciseRepositoriesForExam as getExerciseRepositoriesForExamFromApi,
  updateExerciseRepository as updateExerciseRepositoryFromApi,
} from "@/generated/api/sdk.generated"
import type { ExerciseRepository as GeneratedExerciseRepository } from "@/generated/api/types.generated"
import { ExerciseRepository, NewExerciseRepository } from "@/shared-module/common/bindings"

const normalizeExerciseRepository = (
  exerciseRepository: GeneratedExerciseRepository,
): ExerciseRepository => ({
  ...exerciseRepository,
  course_id: exerciseRepository.course_id ?? null,
  error_message: exerciseRepository.error_message ?? null,
  exam_id: exerciseRepository.exam_id ?? null,
})

export const addExerciseRepository = async (
  courseId: string | null,
  examId: string | null,
  gitUrl: string,
  publicKey: string,
  deployKey: string,
): Promise<string> => {
  const data: NewExerciseRepository = {
    course_id: courseId,
    exam_id: examId,
    git_url: gitUrl,
    public_key: publicKey.length > 0 ? publicKey : null,
    deploy_key: deployKey.length > 0 ? deployKey : null,
  }

  return await createExerciseRepositoryFromApi({
    body: data,
    throwOnError: true,
  })
}

export const addExerciseRepositoryMutationOptions = () => createExerciseRepositoryMutation()

export const editExerciseRepository = async (id: string, gitUrl: string): Promise<void> => {
  await updateExerciseRepositoryFromApi({
    path: {
      id,
    },
    body: {
      url: gitUrl,
    },
    throwOnError: true,
  })
}

export const updateExerciseRepositoryMutationOptions = () => updateExerciseRepositoryMutation()

export const getExerciseRepositories = async (
  courseId: string | null,
  examId: string | null,
): Promise<ExerciseRepository[]> => {
  if (courseId) {
    const repositories = await getExerciseRepositoriesForCourseFromApi({
      path: {
        course_id: courseId,
      },
      throwOnError: true,
    })

    return repositories.map(normalizeExerciseRepository)
  }

  if (examId) {
    const repositories = await getExerciseRepositoriesForExamFromApi({
      path: {
        exam_id: examId,
      },
      throwOnError: true,
    })

    return repositories.map(normalizeExerciseRepository)
  }

  throw new Error("No course or exam id given")
}

export const getExerciseRepositoriesOptions = (courseId: string | null, examId: string | null) => {
  return queryOptions({
    queryKey: ["getExerciseRepositories", courseId, examId],
    queryFn: () => getExerciseRepositories(courseId, examId),
  })
}

export const deleteExerciseRepository = async (id: string): Promise<void> => {
  await deleteExerciseRepositoryFromApi({
    path: {
      id,
    },
    throwOnError: true,
  })
}

export const deleteExerciseRepositoryMutationOptions = () => deleteExerciseRepositoryMutation()
