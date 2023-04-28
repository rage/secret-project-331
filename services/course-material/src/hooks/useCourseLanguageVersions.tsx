import { useQuery } from "@tanstack/react-query"

import { fetchCourseLanguageVersions } from "../services/backend"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"

const useCourseLanguageVersions = (courseId: string | undefined) => {
  const query = useQuery(
    [`courses-${courseId}`],
    () => {
      return fetchCourseLanguageVersions(assertNotNullOrUndefined(courseId))
    },
    { enabled: courseId !== undefined },
  )
  return query
}
export default useCourseLanguageVersions
