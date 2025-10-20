"use client"
import { useQuery } from "@tanstack/react-query"

import { fetchCourseInstances } from "@/services/backend"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface UseCourseInstancesOptions {
  enabled?: boolean
}

const useCourseInstances = (courseId: string | null, options: UseCourseInstancesOptions = {}) => {
  const { enabled = true } = options
  const query = useQuery({
    queryKey: ["course-instances", courseId],
    queryFn: () => fetchCourseInstances(assertNotNullOrUndefined(courseId)),
    enabled: courseId !== null && enabled,
  })
  return query
}

export default useCourseInstances
