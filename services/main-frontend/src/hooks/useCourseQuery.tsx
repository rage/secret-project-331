"use client"

import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query"

import { getCourseQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import { getCourse as getCourseFromApi } from "@/generated/api/sdk.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const GET_COURSE_QUERY_KEY = "getCourse"

const getCourseQueryOptions = (courseId: string | null | undefined) =>
  queryOptions({
    queryKey: [{ _id: GET_COURSE_QUERY_KEY, path: { course_id: courseId } }] as const,
    queryFn: () =>
      getCourseFromApi({
        path: {
          course_id: assertNotNullOrUndefined(courseId),
        },
        throwOnError: true,
      }),
  })

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
  const query = useQuery({
    ...getCourseQueryOptions(courseId),
    enabled: !!courseId,
  })

  return query
}
