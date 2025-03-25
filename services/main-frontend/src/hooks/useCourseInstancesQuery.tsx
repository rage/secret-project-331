import { useQuery, UseQueryResult } from "@tanstack/react-query"

import { fetchCourseInstances } from "../services/backend/courses"

import { HookQueryOptions } from "."

import { CourseInstance } from "@/shared-module/common/bindings"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const useCourseInstancesQuery = (
  courseId: string | null,
  options: HookQueryOptions<CourseInstance[]> = {},
): UseQueryResult<CourseInstance[], Error> => {
  return useQuery({
    queryKey: [`course-course-instances`, courseId],
    queryFn: () => fetchCourseInstances(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
    ...options,
  })
}

export default useCourseInstancesQuery
