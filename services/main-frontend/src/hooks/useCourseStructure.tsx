import { useQuery } from "@tanstack/react-query"

import { fetchCourseStructure } from "../services/backend/courses"

export const useCourseStructure = (courseId: string) => {
  const getCourseStructure = useQuery([`course-structure-${courseId}`], () =>
    fetchCourseStructure(courseId))

  return getCourseStructure
}
