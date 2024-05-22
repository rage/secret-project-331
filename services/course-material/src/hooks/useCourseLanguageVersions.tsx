import { useQuery } from "@tanstack/react-query"

import { fetchCourseLanguageVersions } from "../services/backend"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const useCourseLanguageVersions = (courseId: string | undefined | null) => {
  const query = useQuery({
    queryKey: [`course-language-versions-${courseId}`],
    queryFn: () => {
      return fetchCourseLanguageVersions(assertNotNullOrUndefined(courseId))
    },
    enabled: courseId !== undefined && courseId !== null,
  })
  return query
}
export default useCourseLanguageVersions
