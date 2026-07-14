"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"

import {
  getCourseLanguageVersionsQueryKey as getCourseLanguageVersionsGeneratedQueryKey,
  getCourseLanguageVersionsOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

export const getCourseLanguageVersionsQueryKey = (courseId: string) =>
  getCourseLanguageVersionsGeneratedQueryKey({
    path: {
      course_id: courseId,
    },
  })

export const invalidateCourseLanguageVersions = (queryClient: QueryClient, courseId: string) => {
  queryClient.invalidateQueries({ queryKey: getCourseLanguageVersionsQueryKey(courseId) })
}

const useCourseLanguageVersions = (courseId: string | null) => {
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getCourseLanguageVersionsOptions({
          path: {
            course_id: value,
          },
        }),
    }),
  )

  return query
}

export default useCourseLanguageVersions
