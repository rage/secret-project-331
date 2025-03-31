import { useQuery, UseQueryResult } from "@tanstack/react-query"

import { fetchCourseInstances } from "../services/backend/courses"

import { HookQueryOptions } from "."

import { CourseInstance } from "@/shared-module/common/bindings"
import { queryClient } from "@/shared-module/common/services/appQueryClient"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const getCourseInstancesQueryKey = (courseId: string | null) => [
  // eslint-disable-next-line i18next/no-literal-string
  `course-course-instances`,
  courseId,
]

export const invalidateCourseInstances = (courseId: string) => {
  queryClient.invalidateQueries({ queryKey: getCourseInstancesQueryKey(courseId) })
}

const useCourseInstancesQuery = (
  courseId: string | null,
  options: HookQueryOptions<CourseInstance[]> = {},
): UseQueryResult<CourseInstance[], Error> => {
  return useQuery({
    queryKey: getCourseInstancesQueryKey(courseId),
    queryFn: () => fetchCourseInstances(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export default useCourseInstancesQuery
