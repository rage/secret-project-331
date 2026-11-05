"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseModuleEndQuestionsForUserOptions } from "@/generated/api/@tanstack/react-query.generated"

/** Fetches all end questions and user-given answers for the given course and user. */
export const useCourseEndQuestionsWithAnswers = (courseId: string, userId: string) => {
  return useQuery({
    ...getCourseModuleEndQuestionsForUserOptions({
      path: {
        course_id: courseId,
        user_id: userId,
      },
    }),
    enabled: !!courseId && !!userId,
  })
}
