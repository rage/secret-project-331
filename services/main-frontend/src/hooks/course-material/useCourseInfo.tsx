"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialCourseOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const useCourseInfo = (courseId: string | undefined | null) => {
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
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
export default useCourseInfo
