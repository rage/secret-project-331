"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseBreadcrumbInfoOptions } from "@/generated/api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const useCourseBreadcrumbInfoQuery = (courseId: string | null) => {
  return useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getCourseBreadcrumbInfoOptions({
          path: {
            course_id: value,
          },
        }),
    }),
  )
}

export default useCourseBreadcrumbInfoQuery
