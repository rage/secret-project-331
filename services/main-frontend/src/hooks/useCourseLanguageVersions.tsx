"use client"

import { QueryClient, useQuery } from "@tanstack/react-query"

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
      isReady: (courseId): courseId is string => Boolean(courseId),
      build: (courseId) =>
        getCourseLanguageVersionsOptions({
          path: {
            course_id: courseId,
          },
        }),
    }),
  )

  return query
}

export default useCourseLanguageVersions
