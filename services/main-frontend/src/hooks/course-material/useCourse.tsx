"use client"

import { skipToken, useQuery } from "@tanstack/react-query"

import { getCourseMaterialCourse } from "@/generated/course-material-api/sdk.generated"

interface UseCourseOptions {
  enabled?: boolean
}

const COURSE_MATERIAL_COURSE_QUERY_KEY = "courseMaterialCourse"

const useCourse = (courseId: string | undefined | null, options: UseCourseOptions = {}) => {
  const { enabled = true } = options

  const query = useQuery({
    queryKey: [COURSE_MATERIAL_COURSE_QUERY_KEY, courseId] as const,
    queryFn: courseId
      ? () =>
          getCourseMaterialCourse({
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

export default useCourse
