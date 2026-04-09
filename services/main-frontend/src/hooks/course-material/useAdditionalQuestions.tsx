"use client"

import { skipToken, useQuery } from "@tanstack/react-query"

import { getCourseMaterialBackgroundQuestionsAndAnswers } from "@/generated/course-material-api/sdk.generated"

interface UseAdditionalQuestionsOptions {
  enabled?: boolean
}

const COURSE_MATERIAL_ADDITIONAL_QUESTIONS_QUERY_KEY = "courseMaterialAdditionalQuestions"

const useAdditionalQuestions = (
  instanceId: string | null | undefined,
  options: UseAdditionalQuestionsOptions = {},
) => {
  const { enabled = true } = options

  const query = useQuery({
    queryKey: [COURSE_MATERIAL_ADDITIONAL_QUESTIONS_QUERY_KEY, instanceId] as const,
    queryFn: instanceId
      ? () =>
          getCourseMaterialBackgroundQuestionsAndAnswers({
            path: {
              course_instance_id: instanceId,
            },
            throwOnError: true,
          })
      : skipToken,
    enabled: !!instanceId && enabled,
  })
  return query
}

export default useAdditionalQuestions
