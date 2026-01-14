"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchBackgroundQuestionsAndAnswers } from "@/services/course-material/backend"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface UseAdditionalQuestionsOptions {
  enabled?: boolean
}

const useAdditionalQuestions = (
  instanceId: string | null | undefined,
  options: UseAdditionalQuestionsOptions = {},
) => {
  const { enabled = true } = options
  const query = useQuery({
    queryKey: ["additional-questions", instanceId],
    queryFn: () => fetchBackgroundQuestionsAndAnswers(assertNotNullOrUndefined(instanceId)),
    enabled: instanceId !== null && instanceId !== undefined && enabled,
  })
  return query
}

export default useAdditionalQuestions
