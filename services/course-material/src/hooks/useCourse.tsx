"use client"
import { useQuery } from "@tanstack/react-query"

import { fetchCourseById } from "@/services/backend"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface UseCourseOptions {
  enabled?: boolean
}

const useCourse = (courseId: string | undefined | null, options: UseCourseOptions = {}) => {
  const { enabled = true } = options
  const query = useQuery({
    queryKey: ["courses", courseId],
    queryFn: () => fetchCourseById(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId && enabled,
  })
  return query
}

export default useCourse
