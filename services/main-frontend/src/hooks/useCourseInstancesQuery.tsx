"use client"

import { queryOptions, useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query"

import { HookQueryOptions } from "."

import { getCourseInstancesQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import { getCourseInstances as getCourseInstancesFromApi } from "@/generated/api/sdk.generated"
import type { CourseInstance } from "@/generated/api/types.generated"
import { queryClient } from "@/shared-module/common/services/appQueryClient"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const GET_COURSE_INSTANCES_QUERY_KEY = "getCourseInstances"

const getCourseInstancesQueryOptions = (courseId: string | null | undefined) =>
  queryOptions({
    queryKey: [{ _id: GET_COURSE_INSTANCES_QUERY_KEY, path: { course_id: courseId } }] as const,
    queryFn: (): Promise<CourseInstance[]> =>
      getCourseInstancesFromApi({
        path: {
          course_id: assertNotNullOrUndefined(courseId),
        },
      }),
  })

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
  const generatedOptions = getCourseInstancesQueryOptions(courseId)

  return useQuery({
    ...(generatedOptions as UseQueryOptions<CourseInstance[], Error, CourseInstance[]>),
    enabled: !!courseId,
    ...options,
  })
}

export default useCourseInstancesQuery
