"use client"

import { useQuery } from "@tanstack/react-query"

import { getCoursePageVisitDatumSummaryOptions } from "@/generated/api/@tanstack/react-query.generated"

const useCoursePageVisitDatumSummary = (courseId: string) => {
  const query = useQuery({
    ...getCoursePageVisitDatumSummaryOptions({
      path: {
        course_id: courseId,
      },
    }),
  })
  return query
}

export default useCoursePageVisitDatumSummary
