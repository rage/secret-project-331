"use client"

import { skipToken, useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getCourseMaterialResearchConsentForm } from "@/generated/course-material-api/sdk.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

interface UseResearchConsentFormOptions {
  enabled?: boolean
}

const COURSE_MATERIAL_RESEARCH_CONSENT_FORM_QUERY_KEY = "courseMaterialResearchConsentForm"

const useResearchConsentForm = (
  courseId: string | null | undefined,
  options: UseResearchConsentFormOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery({
    queryKey: [COURSE_MATERIAL_RESEARCH_CONSENT_FORM_QUERY_KEY, courseId] as const,
    queryFn: courseId
      ? () =>
          getCourseMaterialResearchConsentForm({
            path: {
              course_id: courseId,
            },
          })
      : skipToken,
    enabled: loginState.signedIn === true && Boolean(courseId) && enabled,
  })
  return query
}

export default useResearchConsentForm
