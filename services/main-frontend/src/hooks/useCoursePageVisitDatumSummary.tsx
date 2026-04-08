"use client"

import { useQuery } from "@tanstack/react-query"

import { getCoursePageVisitDatumSummaryOptions } from "../services/backend/courses"

const useCoursePageVisitDatumSummary = (courseId: string) => {
  const query = useQuery(getCoursePageVisitDatumSummaryOptions(courseId))
  return query
}

export default useCoursePageVisitDatumSummary
