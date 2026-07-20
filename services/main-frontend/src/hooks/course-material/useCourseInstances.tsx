"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialCourseInstancesOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseCourseInstancesOptions {
  enabled?: boolean
}

const useCourseInstances = (courseId: string | null, options: UseCourseInstancesOptions = {}) => {
  const { enabled = true } = options
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getCourseMaterialCourseInstancesOptions({
          path: {
            course_id: value,
          },
        }),
    }),
  )
  return query
}

export default useCourseInstances
