"use client"

import { useQuery } from "@tanstack/react-query"

import { getUsersByCourseIdForUserDetailsOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useUsers = (courseId: string) => {
  return useQuery({
    ...getUsersByCourseIdForUserDetailsOptions({
      path: {
        course_id: courseId,
      },
    }),
    enabled: !!courseId,
  })
}
