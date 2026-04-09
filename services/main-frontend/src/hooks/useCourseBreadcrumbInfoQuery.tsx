"use client"

import { queryOptions, useQuery } from "@tanstack/react-query"

import { getCourseBreadcrumbInfo as getCourseBreadCrumbInfoFromApi } from "@/generated/api/sdk.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const GET_COURSE_BREADCRUMB_INFO_QUERY_KEY = "getCourseBreadcrumbInfo"

const getCourseBreadCrumbInfoQueryOptions = (courseId: string | null | undefined) =>
  queryOptions({
    queryKey: [
      { _id: GET_COURSE_BREADCRUMB_INFO_QUERY_KEY, path: { course_id: courseId } },
    ] as const,
    queryFn: () =>
      getCourseBreadCrumbInfoFromApi({
        path: {
          course_id: assertNotNullOrUndefined(courseId),
        },
        throwOnError: true,
      }),
  })

const useCourseBreadcrumbInfoQuery = (courseId: string | null) => {
  return useQuery({
    ...getCourseBreadCrumbInfoQueryOptions(courseId),
    enabled: !!courseId,
  })
}

export default useCourseBreadcrumbInfoQuery
