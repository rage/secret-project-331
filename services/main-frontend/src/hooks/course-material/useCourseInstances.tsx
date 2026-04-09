"use client"

import { skipToken, useQuery } from "@tanstack/react-query"

import { getCourseMaterialCourseInstances } from "@/generated/course-material-api/sdk.generated"
import type { CourseInstance } from "@/generated/course-material-api/types.generated"

interface UseCourseInstancesOptions {
  enabled?: boolean
}

const COURSE_MATERIAL_COURSE_INSTANCES_QUERY_KEY = "courseMaterialCourseInstances"

const useCourseInstances = (courseId: string | null, options: UseCourseInstancesOptions = {}) => {
  const { enabled = true } = options
  const query = useQuery<CourseInstance[]>({
    queryKey: [COURSE_MATERIAL_COURSE_INSTANCES_QUERY_KEY, courseId] as const,
    queryFn: courseId
      ? () =>
          getCourseMaterialCourseInstances({
            path: {
              course_id: courseId,
            },
            throwOnError: true,
          })
      : skipToken,
    enabled: !!courseId && enabled,
  })
  return query
}

export default useCourseInstances
