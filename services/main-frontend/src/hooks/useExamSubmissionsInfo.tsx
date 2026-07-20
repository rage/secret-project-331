"use client"

import { useQuery } from "@tanstack/react-query"

import { getExamSubmissionsWithExerciseIdOptions } from "@/generated/api/@tanstack/react-query.generated"

const useExamSubmissionsInfo = (exercise_id: string, pageNumber: number, pageLimit: number) => {
  return useQuery({
    ...getExamSubmissionsWithExerciseIdOptions({
      path: {
        exercise_id,
      },
      query: {
        page: pageNumber,
        limit: pageLimit,
      },
    }),
  })
}

export default useExamSubmissionsInfo
