"use client"

import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getCourseMaterialResearchConsentFormAnswersOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseResearchConsentFormAnswersOptions {
  enabled?: boolean
}

const useResearchConsentFormAnswers = (
  courseId: string | null | undefined,
  options: UseResearchConsentFormAnswersOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: loginState.signedIn === true && enabled,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getCourseMaterialResearchConsentFormAnswersOptions({
          path: {
            course_id: value,
          },
        }),
    }),
  )
  return query
}

export default useResearchConsentFormAnswers
