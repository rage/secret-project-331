"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialCourseOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseCourseOptions {
  enabled?: boolean
}

const useCourse = (courseId: string | undefined | null, options: UseCourseOptions = {}) => {
  const { enabled = true } = options

  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled,
      isReady: (courseId): courseId is string => Boolean(courseId),
      build: (courseId) =>
        getCourseMaterialCourseOptions({
          path: {
            course_id: courseId,
          },
        }),
    }),
  )
  return query
}

export default useCourse
