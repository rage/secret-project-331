import { useQuery } from "@tanstack/react-query"

import { fetchCourseStructure } from "../services/backend/courses"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"

export const useCourseStructure = (courseId: string | null) => {
  const getCourseStructure = useQuery(
    [`course-structure-${courseId}`],
    () => fetchCourseStructure(assertNotNullOrUndefined(courseId)),
    { enabled: !!courseId },
  )

  return getCourseStructure
}
