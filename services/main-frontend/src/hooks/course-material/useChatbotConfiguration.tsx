"use client"

import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getDefaultChatbotConfigurationForCourseOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseChatbotConfigurationOptions {
  enabled?: boolean
}

const useChatbotConfiguration = (
  courseId: string | null | undefined,
  options: UseChatbotConfigurationOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)

  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: loginState.signedIn === true && enabled,
      isReady: (courseId): courseId is string => Boolean(courseId),
      build: (courseId) =>
        getDefaultChatbotConfigurationForCourseOptions({
          path: {
            course_id: courseId,
          },
        }),
    }),
  )
  return query
}

export default useChatbotConfiguration
