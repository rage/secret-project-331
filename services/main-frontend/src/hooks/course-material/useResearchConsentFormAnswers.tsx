"use client"

import { skipToken, useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getCourseMaterialResearchConsentFormAnswers } from "@/generated/course-material-api/sdk.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

interface UseResearchConsentFormAnswersOptions {
  enabled?: boolean
}

const COURSE_MATERIAL_RESEARCH_CONSENT_FORM_ANSWERS_QUERY_KEY =
  "courseMaterialResearchConsentFormAnswers"

const useResearchConsentFormAnswers = (
  courseId: string | null | undefined,
  options: UseResearchConsentFormAnswersOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery({
    queryKey: [COURSE_MATERIAL_RESEARCH_CONSENT_FORM_ANSWERS_QUERY_KEY, courseId] as const,
    queryFn: courseId
      ? () =>
          getCourseMaterialResearchConsentFormAnswers({
            path: {
              course_id: courseId,
            },
            throwOnError: true,
          })
      : skipToken,
    enabled: loginState.signedIn === true && Boolean(courseId) && enabled,
  })
  return query
}

export default useResearchConsentFormAnswers
