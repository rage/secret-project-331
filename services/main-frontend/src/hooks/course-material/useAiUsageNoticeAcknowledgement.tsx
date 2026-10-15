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
 * given course. Only runs when signed in and a non-null `courseId` is provided.
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
      isReady: (id): id is string => Boolean(id),
      build: (id) =>
        getAiUsageNoticeAcknowledgementOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )
  return query
}

export default useAiUsageNoticeAcknowledgement
