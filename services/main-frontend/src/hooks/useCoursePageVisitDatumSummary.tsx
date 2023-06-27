import { useQuery } from "@tanstack/react-query"

import { fetchCoursePageVisitDatumSummaries } from "../services/backend/courses"

const useCoursePageVisitDatumSummary = (courseId: string) => {
  const query = useQuery([`course-page-visit-datum-summary-${courseId}`], () =>
    fetchCoursePageVisitDatumSummaries(courseId),
  )
  return query
}

export default useCoursePageVisitDatumSummary
