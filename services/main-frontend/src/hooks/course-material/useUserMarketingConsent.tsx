"use client"

import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { fetchUserMarketingConsent } from "@/services/course-material/backend"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface UseUserMarketingConsentOptions {
  enabled?: boolean
}

const useUserMarketingConsent = (
  courseId: string | null,
  options: UseUserMarketingConsentOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery({
    queryKey: ["marketing-consent", courseId],
    queryFn: () => fetchUserMarketingConsent(assertNotNullOrUndefined(courseId)),
    enabled: courseId !== null && loginState.signedIn === true && enabled,
  })
  return query
}

export default useUserMarketingConsent
