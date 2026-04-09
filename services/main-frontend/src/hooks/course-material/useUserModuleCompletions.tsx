"use client"

import { skipToken, useQuery } from "@tanstack/react-query"

import { getCourseMaterialUserModuleCompletions } from "@/generated/course-material-api/sdk.generated"

const COURSE_MATERIAL_USER_MODULE_COMPLETIONS_QUERY_KEY = "courseMaterialUserModuleCompletions"

const useUserModuleCompletions = (courseInstanceId: string | undefined | null) => {
  const query = useQuery({
    queryKey: [COURSE_MATERIAL_USER_MODULE_COMPLETIONS_QUERY_KEY, courseInstanceId] as const,
    queryFn: courseInstanceId
      ? () =>
          getCourseMaterialUserModuleCompletions({
            path: {
              course_instance_id: courseInstanceId,
            },
          })
      : skipToken,
    enabled: !!courseInstanceId,
  })
  return query
}

export default useUserModuleCompletions
