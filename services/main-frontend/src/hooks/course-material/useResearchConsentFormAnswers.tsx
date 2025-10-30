"use client"
import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { fetchResearchFormAnswersWithUserId } from "@/services/course-material/backend"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface UseResearchConsentFormAnswersOptions {
  enabled?: boolean
}

const useResearchConsentFormAnswers = (
  courseId: string | null | undefined,
  options: UseResearchConsentFormAnswersOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery({
    queryKey: [`courses-${courseId}-research-consent-form-user-answer`],
    queryFn: () => fetchResearchFormAnswersWithUserId(assertNotNullOrUndefined(courseId)),
    enabled: loginState.signedIn === true && Boolean(courseId) && enabled,
  })
  return query
}

export default useResearchConsentFormAnswers
