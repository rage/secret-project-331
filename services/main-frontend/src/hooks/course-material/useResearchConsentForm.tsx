"use client"

import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { fetchResearchFormWithCourseId } from "@/services/course-material/backend"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface UseResearchConsentFormOptions {
  enabled?: boolean
}

const useResearchConsentForm = (
  courseId: string | null | undefined,
  options: UseResearchConsentFormOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery({
    queryKey: [`courses-${courseId}-research-consent-form`],
    queryFn: () => fetchResearchFormWithCourseId(assertNotNullOrUndefined(courseId)),
    enabled: loginState.signedIn === true && Boolean(courseId) && enabled,
  })
  return query
}

export default useResearchConsentForm
