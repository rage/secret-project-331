"use client"

import { useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query"

import { HookQueryOptions } from "."

import {
  getCourseInstancesOptions,
  getCourseInstancesQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import type { CourseInstance } from "@/generated/api/types.generated"
import { queryClient } from "@/shared-module/common/services/appQueryClient"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

export const invalidateCourseInstances = (courseId: string) => {
  queryClient.invalidateQueries({
    queryKey: getCourseInstancesQueryKey({
      path: {
        course_id: courseId,
      },
    }),
  })
}

const useCourseInstancesQuery = (
  courseId: string | null,
  options: HookQueryOptions<CourseInstance[]> = {},
): UseQueryResult<CourseInstance[], Error> => {
  const generatedOptions = optionalGeneratedQueryOptions({
    value: courseId,
    isReady: (courseId): courseId is string => Boolean(courseId),
    build: (courseId) =>
      getCourseInstancesOptions({
        path: {
          course_id: courseId,
        },
      }),
  })

  return useQuery({
    ...(generatedOptions as UseQueryOptions<CourseInstance[], Error, CourseInstance[]>),
    ...options,
  })
}

export default useCourseInstancesQuery
