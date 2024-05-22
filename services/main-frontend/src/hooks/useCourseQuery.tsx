import { useQuery } from "@tanstack/react-query"

import { getCourse } from "../services/backend/courses"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

const useCourseQuery = (courseId: string | null) => {
  return useQuery({
    queryKey: [`course-${courseId}`],
    queryFn: () => getCourse(assertNotNullOrUndefined(courseId)),
    enabled: courseId !== null,
  })
}

export default useCourseQuery
