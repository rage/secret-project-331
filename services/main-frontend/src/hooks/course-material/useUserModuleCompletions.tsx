"use client"

import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialUserModuleCompletionsOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const useUserModuleCompletions = (courseInstanceId: string | undefined | null) => {
  const query = useQuery(
    optionalGeneratedQueryOptions({
      value: courseInstanceId,
      isReady: (courseInstanceId): courseInstanceId is string => Boolean(courseInstanceId),
      build: (courseInstanceId) =>
        getCourseMaterialUserModuleCompletionsOptions({
          path: {
            course_instance_id: courseInstanceId,
          },
        }),
    }),
  )
  return query
}

export default useUserModuleCompletions
