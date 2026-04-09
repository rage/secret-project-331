"use client"

import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query"

import { getCourseLanguageVersionsQueryKey as getCourseLanguageVersionsGeneratedQueryKey } from "@/generated/api/@tanstack/react-query.generated"
import { getCourseLanguageVersions as getCourseLanguageVersionsFromApi } from "@/generated/api/sdk.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const GET_COURSE_LANGUAGE_VERSIONS_QUERY_KEY = "getCourseLanguageVersions"

const getCourseLanguageVersionsQueryOptions = (courseId: string | null | undefined) =>
  queryOptions({
    queryKey: [
      { _id: GET_COURSE_LANGUAGE_VERSIONS_QUERY_KEY, path: { course_id: courseId } },
    ] as const,
    queryFn: () =>
      getCourseLanguageVersionsFromApi({
        path: {
          course_id: assertNotNullOrUndefined(courseId),
        },
        throwOnError: true,
      }),
  })

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
  const query = useQuery({
    ...getCourseLanguageVersionsQueryOptions(courseId),
    enabled: !!courseId,
  })

  return query
}

export default useCourseLanguageVersions
