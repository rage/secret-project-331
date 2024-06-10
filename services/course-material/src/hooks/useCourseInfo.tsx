import { useQuery } from "@tanstack/react-query"

import { fetchCourseById } from "../services/backend"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const useCourseInfo = (courseId: string | undefined | null) => {
  const query = useQuery({
    queryKey: [`courses-${courseId}`],
    queryFn: () => {
      return fetchCourseById(assertNotNullOrUndefined(courseId))
    },
    enabled: courseId !== undefined && courseId !== null,
  })
  return query
}
export default useCourseInfo
