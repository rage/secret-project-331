import { useQuery } from "@tanstack/react-query"

import { fetchCourseById } from "../services/backend"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"

const useCourseInfo = (courseId: string | undefined) => {
  const query = useQuery(
    [`courses-${courseId}`],
    () => {
      return fetchCourseById(assertNotNullOrUndefined(courseId))
    },
    { enabled: courseId !== undefined },
  )
  return query
}
export default useCourseInfo
