import { useQuery } from "@tanstack/react-query"

import { getAllCourseModuleCompletionsForUserAndCourse } from "../services/backend/courses"

export const useCourseModuleCompletions = (courseId: string, userId: string) => {
  return useQuery({
    queryKey: [`${courseId}-course-module-completions-${userId}`],
    queryFn: () => getAllCourseModuleCompletionsForUserAndCourse(courseId, userId),
  })
}
