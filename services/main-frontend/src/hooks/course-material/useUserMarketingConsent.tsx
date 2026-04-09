"use client"

import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getCourseMaterialUserMarketingConsentOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseUserMarketingConsentOptions {
  enabled?: boolean
}

const useUserMarketingConsent = (
  courseId: string | null,
  options: UseUserMarketingConsentOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: loginState.signedIn === true && enabled,
      isReady: (courseId): courseId is string => Boolean(courseId),
      build: (courseId) =>
        getCourseMaterialUserMarketingConsentOptions({
          path: {
            course_id: courseId,
          },
        }),
    }),
  )
  return query
}

export default useUserMarketingConsent
