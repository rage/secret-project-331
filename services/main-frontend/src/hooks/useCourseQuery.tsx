import { useQuery } from "@tanstack/react-query"

import { getCourse } from "../services/backend/courses"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"

const useCourseQuery = (courseId: string | null) => {
  return useQuery([`course-${courseId}`], () => getCourse(assertNotNullOrUndefined(courseId)), {
    enabled: courseId !== null,
  })
}

export default useCourseQuery
