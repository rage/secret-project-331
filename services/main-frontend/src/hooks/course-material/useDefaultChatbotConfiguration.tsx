"use client"

import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getDefaultChatbotConfigurationForCourseOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface UseDefaultChatbotConfigurationOptions {
  enabled?: boolean
}

const useDefaultChatbotConfiguration = (
  courseId: string | null | undefined,
  options: UseDefaultChatbotConfigurationOptions = {},
) => {
  const { enabled = true } = options
  const loginState = useContext(LoginStateContext)

  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      enabled: loginState.signedIn === true && enabled,
      isReady: (id): id is string => Boolean(id),
      build: (id) =>
        getDefaultChatbotConfigurationForCourseOptions({
          path: {
            course_id: id,
          },
        }),
    }),
  )
  return query
}

export default useDefaultChatbotConfiguration
