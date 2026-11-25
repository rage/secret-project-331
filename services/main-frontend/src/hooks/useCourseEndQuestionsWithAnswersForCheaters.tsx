"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseModuleEndQuestionAnswersForSuspectedCheatersOptions } from "@/generated/api/@tanstack/react-query.generated"

/** Fetches all end questions and user-given answers for the given course and user. */
export const useCourseEndQuestionsWithAnswersForCheaters = (courseId: string) => {
  return useQuery({
    ...getCourseModuleEndQuestionAnswersForSuspectedCheatersOptions({
      path: {
        course_id: courseId,
      },
    }),
    enabled: !!courseId,
  })
}
