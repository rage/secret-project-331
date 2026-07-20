"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialBackgroundQuestionsAndAnswersOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseAdditionalQuestionsOptions {
  enabled?: boolean
}

const useAdditionalQuestions = (
  instanceId: string | null | undefined,
  options: UseAdditionalQuestionsOptions = {},
) => {
  const { enabled = true } = options

  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: instanceId,
      enabled,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getCourseMaterialBackgroundQuestionsAndAnswersOptions({
          path: {
            course_instance_id: value,
          },
        }),
    }),
  )
  return query
}

export default useAdditionalQuestions
