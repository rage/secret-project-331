import { useQuery } from "@tanstack/react-query"

import { getCourse } from "../services/backend/courses"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

// eslint-disable-next-line i18next/no-literal-string
export const formatCourseQueryKey = (courseId: string) => [`course-${courseId}`]

const useCourseQuery = (courseId: string | null) => {
  return useQuery({
    queryKey: formatCourseQueryKey(assertNotNullOrUndefined(courseId)),
    queryFn: () => getCourse(assertNotNullOrUndefined(courseId)),
    enabled: courseId !== null,
  })
}

export default useCourseQuery
