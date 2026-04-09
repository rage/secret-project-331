"use client"

import { skipToken, useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getDefaultChatbotConfigurationForCourse } from "@/generated/course-material-api/sdk.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

interface UseChatbotConfigurationOptions {
  enabled?: boolean
}

const DEFAULT_CHATBOT_CONFIGURATION_QUERY_KEY = "defaultChatbotConfigurationForCourse"

const useChatbotConfiguration = (
  courseId: string | null | undefined,
  options: UseChatbotConfigurationOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)

  const query = useQuery({
    queryKey: [DEFAULT_CHATBOT_CONFIGURATION_QUERY_KEY, courseId] as const,
    queryFn: courseId
      ? () =>
          getDefaultChatbotConfigurationForCourse({
            path: {
              course_id: courseId,
            },
          })
      : skipToken,
    enabled: loginState.signedIn === true && Boolean(courseId) && enabled,
  })
  return query
}

export default useChatbotConfiguration
