import { useQuery } from "@tanstack/react-query"

import { getCourseModuleCompletionsForUserOptions } from "../services/backend/courses"

export const useCourseModuleCompletions = (courseId: string, userId: string) => {
  return useQuery(getCourseModuleCompletionsForUserOptions(courseId, userId))
}
