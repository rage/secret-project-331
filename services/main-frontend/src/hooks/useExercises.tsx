"use client"

import { useQuery } from "@tanstack/react-query"

import { getExercisesByCourseIdOptions } from "@/services/backend/exercises"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useExercises = (courseId: string) => {
  return useQuery({
    ...getExercisesByCourseIdOptions(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}
