"use client"

import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getMyCourseCreditRegistrationConsentOptions } from "@/generated/api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseCourseCreditRegistrationConsentOptions {
  enabled?: boolean
}

const CONSENT_STALE_TIME_MS = 5 * 60 * 1000

/** Gates a course-start dialog step, so it must settle before that decision is made. */
const useCourseCreditRegistrationConsent = (
  courseId: string | null,
  options: UseCourseCreditRegistrationConsentOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: loginState.signedIn === true && enabled,
      isReady: (id): id is string => Boolean(id),
      build: (id) => ({
        ...getMyCourseCreditRegistrationConsentOptions({
          path: {
            course_id: id,
          },
        }),
        // Read on every page load, and only the dialog's own answer changes it.
        staleTime: CONSENT_STALE_TIME_MS,
      }),
    }),
  )
  return query
}

export default useCourseCreditRegistrationConsent
