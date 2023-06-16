import { useQuery } from "@tanstack/react-query"

import { fetchCourseLanguageVersions } from "../services/backend"
import { assertNotNullOrUndefined } from "../shared-module/utils/nullability"

const useCourseLanguageVersions = (courseId: string | undefined | null) => {
  const query = useQuery(
    [`course-language-versions-${courseId}`],
    () => {
      return fetchCourseLanguageVersions(assertNotNullOrUndefined(courseId))
    },
    { enabled: courseId !== undefined && courseId !== null },
  )
  return query
}
export default useCourseLanguageVersions
