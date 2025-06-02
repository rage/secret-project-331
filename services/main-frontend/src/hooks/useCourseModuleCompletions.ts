import { useQuery } from "@tanstack/react-query"

import { getAllCourseModuleCompletionsForUserAndCourseInstance } from "../services/backend/course-instances"

export const useCourseModuleCompletions = (courseInstanceId: string, userId: string) => {
  return useQuery({
    queryKey: [`${courseInstanceId}-course-module-completions-${userId}`],
    queryFn: () => getAllCourseModuleCompletionsForUserAndCourseInstance(courseInstanceId, userId),
  })
}
