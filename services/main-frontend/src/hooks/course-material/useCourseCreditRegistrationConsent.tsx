"use client"

import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getMyCourseCreditRegistrationConsentOptions } from "@/generated/api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseCourseCreditRegistrationConsentOptions {
  enabled?: boolean
}

/**
 * The signed-in user's credit registration consent for a course, and whether the course offers it at
 * all. Drives the course-start dialog step, so it must settle before the dialog decision is made.
 */
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
      build: (id) =>
        getMyCourseCreditRegistrationConsentOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )
  return query
}

export default useCourseCreditRegistrationConsent
