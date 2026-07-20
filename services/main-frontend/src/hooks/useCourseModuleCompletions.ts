import { useQuery } from "@tanstack/react-query"

import { getCourseModuleCompletionsForUserOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useCourseModuleCompletions = (courseId: string, userId: string) => {
  return useQuery({
    ...getCourseModuleCompletionsForUserOptions({
      path: {
        course_id: courseId,
        user_id: userId,
      },
    }),
  })
}
