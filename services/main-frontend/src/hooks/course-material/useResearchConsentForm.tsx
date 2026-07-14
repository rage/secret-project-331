"use client"

import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getCourseMaterialResearchConsentFormOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseResearchConsentFormOptions {
  enabled?: boolean
}

const useResearchConsentForm = (
  courseId: string | null | undefined,
  options: UseResearchConsentFormOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: loginState.signedIn === true && enabled,
      isReady: (id): id is string => Boolean(id),
      build: (id) =>
        getCourseMaterialResearchConsentFormOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )
  return query
}

export default useResearchConsentForm
