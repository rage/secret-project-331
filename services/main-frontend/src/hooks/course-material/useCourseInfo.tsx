"use client"

import { skipToken, useQuery } from "@tanstack/react-query"

import { getCourseMaterialCourse } from "@/generated/course-material-api/sdk.generated"

const COURSE_MATERIAL_COURSE_INFO_QUERY_KEY = "courseMaterialCourseInfo"

const useCourseInfo = (courseId: string | undefined | null) => {
  const query = useQuery({
    queryKey: [COURSE_MATERIAL_COURSE_INFO_QUERY_KEY, courseId] as const,
    queryFn: courseId
      ? () =>
          getCourseMaterialCourse({
            path: {
              course_id: courseId,
            },
          })
      : skipToken,
    enabled: !!courseId,
  })
  return query
}
export default useCourseInfo
