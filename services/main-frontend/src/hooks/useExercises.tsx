"use client"

import { useQuery } from "@tanstack/react-query"

import { getExercisesByCourseIdOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useExercises = (courseId: string) => {
  return useQuery({
    ...getExercisesByCourseIdOptions({
      path: {
        course_id: courseId,
      },
    }),
    enabled: !!courseId,
  })
}
