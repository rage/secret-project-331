"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"

import {
  getCourseOptions,
  getCourseQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

export const invalidateCourseQuery = (queryClient: QueryClient, courseId: string) => {
  queryClient.invalidateQueries({
    queryKey: getCourseQueryKey({
      path: {
        course_id: courseId,
      },
    }),
  })
}

export const useCourseQuery = (courseId: string | null) => {
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (id): id is string => Boolean(id),
      build: (id) =>
        getCourseOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )

  return query
}
