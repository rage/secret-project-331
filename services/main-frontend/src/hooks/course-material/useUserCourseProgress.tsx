"use client"

import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getCourseMaterialUserCourseProgressOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

/** Fetches UserCourseProgress for the currently logged-in user. */
const useUserCourseProgress = (courseInstanceId: string | null | undefined) => {
  const loginState = useContext(LoginStateContext)
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseInstanceId,
      enabled: loginState.signedIn === true && !!courseInstanceId,
      isReady: (value): value is string => Boolean(value),
      build: (value) =>
        getCourseMaterialUserCourseProgressOptions({
          path: {
            course_instance_id: value,
          },
        }),
    }),
  )
  return query
}

export default useUserCourseProgress
