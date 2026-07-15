"use client"

import type { UseQueryOptions, UseQueryResult } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"

import type { HookQueryOptions } from "."

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
    isReady: (id): id is string => Boolean(id),
    build: (id) =>
      getCourseInstancesOptions({
        path: {
          course_id: id,
        },
      }),
  })

  return useQuery({
    ...(generatedOptions as UseQueryOptions<CourseInstance[], Error, CourseInstance[]>),
    ...options,
  })
}

export default useCourseInstancesQuery
