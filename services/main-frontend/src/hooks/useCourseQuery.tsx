import { QueryClient, useQuery } from "@tanstack/react-query"

import { getCourse as fetchCourse } from "../services/backend/courses"

import { Course } from "@/shared-module/common/bindings"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

// eslint-disable-next-line i18next/no-literal-string
export const formatCourseQueryKey = (courseId: string) => [`course-${courseId}`]

export const invalidateCourseQuery = (queryClient: QueryClient, courseId: string) => {
  queryClient.invalidateQueries({ queryKey: formatCourseQueryKey(courseId) })
}

export const useCourseQuery = (courseId: string | null) => {
  const query = useQuery<Course>({
    queryKey: formatCourseQueryKey(assertNotNullOrUndefined(courseId)),
    queryFn: () => fetchCourse(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })

  return query
}
