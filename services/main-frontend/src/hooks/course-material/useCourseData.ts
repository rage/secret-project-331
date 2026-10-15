import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialCourseOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"

export interface UseCourseDataOptions {
  courseId: string
}

export const useCourseData = ({ courseId }: UseCourseDataOptions) => {
  return useQuery(
    getCourseMaterialCourseOptions({
      path: {
        course_id: courseId,
      },
    }),
  )
}
