"use client"

import { skipToken, useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getCourseMaterialUserMarketingConsent } from "@/generated/course-material-api/sdk.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

interface UseUserMarketingConsentOptions {
  enabled?: boolean
}

const COURSE_MATERIAL_USER_MARKETING_CONSENT_QUERY_KEY = "courseMaterialUserMarketingConsent"

const useUserMarketingConsent = (
  courseId: string | null,
  options: UseUserMarketingConsentOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery({
    queryKey: [COURSE_MATERIAL_USER_MARKETING_CONSENT_QUERY_KEY, courseId] as const,
    queryFn: courseId
      ? () =>
          getCourseMaterialUserMarketingConsent({
            path: {
              course_id: courseId,
            },
          })
      : skipToken,
    enabled: !!courseId && loginState.signedIn === true && enabled,
  })
  return query
}

export default useUserMarketingConsent
