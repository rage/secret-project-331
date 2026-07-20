"use client"

import { useQuery } from "@tanstack/react-query"

import {
  getCourseMaterialExerciseOptions,
  getCourseMaterialExerciseQueryKey,
} from "@/generated/course-material-api/@tanstack/react-query.generated"
import type { CourseMaterialExercise } from "@/generated/course-material-api/types.generated"

const useCourseMaterialExerciseQuery = (exerciseId: string, showExercise: boolean) => {
  const getCourseMaterialExercise = useQuery({
    ...getCourseMaterialExerciseOptions({
      path: {
        exercise_id: exerciseId,
      },
    }),
    enabled: showExercise,
    select: (data): CourseMaterialExercise => data,
  })
  return getCourseMaterialExercise
}

export const courseMaterialExerciseQueryKey = (id: string) =>
  getCourseMaterialExerciseQueryKey({
    path: {
      exercise_id: id,
    },
  })

export default useCourseMaterialExerciseQuery
