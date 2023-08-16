import { useQuery } from "@tanstack/react-query"

import { fetchCoursePageVisitDatumSummaries } from "../services/backend/courses"

const useCoursePageVisitDatumSummary = (courseId: string) => {
  const query = useQuery({
    queryKey: [`course-page-visit-datum-summary-${courseId}`],
    queryFn: () => fetchCoursePageVisitDatumSummaries(courseId),
  })
  return query
}

export default useCoursePageVisitDatumSummary
