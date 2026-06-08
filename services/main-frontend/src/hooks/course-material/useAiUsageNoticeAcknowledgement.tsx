"use client"

import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getAiUsageNoticeAcknowledgementOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseAiUsageNoticeAcknowledgementOptions {
  enabled?: boolean
}

/**
 * Whether the current user has acknowledged the AI-usage / academic-integrity notice for the
 * given course. Only runs when signed in.
 */
const useAiUsageNoticeAcknowledgement = (
  courseId: string | null,
  options: UseAiUsageNoticeAcknowledgementOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: loginState.signedIn === true && enabled,
      isReady: (courseId): courseId is string => Boolean(courseId),
      build: (courseId) =>
        getAiUsageNoticeAcknowledgementOptions({
          path: {
            course_id: courseId,
          },
        }),
    }),
  )
  return query
}

export default useAiUsageNoticeAcknowledgement
