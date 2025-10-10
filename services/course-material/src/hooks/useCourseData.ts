import { useQuery } from "@tanstack/react-query"

import { fetchCourseById } from "@/services/backend"

export interface UseCourseDataOptions {
  courseId: string
}

export const useCourseData = ({ courseId }: UseCourseDataOptions) => {
  return useQuery({
    queryKey: [`correct-course-${courseId}`],
    queryFn: () => fetchCourseById(courseId),
  })
}
