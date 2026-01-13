"use client"
import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getDefaultChatbotConfigurationForCourse } from "@/services/course-material/backend"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

interface UseChatbotConfigurationOptions {
  enabled?: boolean
}

const useChatbotConfiguration = (
  courseId: string | null | undefined,
  options: UseChatbotConfigurationOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)
  const query = useQuery({
    queryKey: ["chatbot", "default-for-course", courseId],
    queryFn: () => getDefaultChatbotConfigurationForCourse(assertNotNullOrUndefined(courseId)),
    enabled: loginState.signedIn === true && Boolean(courseId) && enabled,
  })
  return query
}

export default useChatbotConfiguration
