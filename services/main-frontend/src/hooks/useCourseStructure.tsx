import { useQuery } from "@tanstack/react-query"

import { fetchCourseStructure } from "../services/backend/courses"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useCourseStructure = (courseId: string | null) => {
  const getCourseStructure = useQuery({
    queryKey: [`course-structure-${courseId}`],
    queryFn: () => fetchCourseStructure(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })

  return getCourseStructure
}
