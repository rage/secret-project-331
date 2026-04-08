"use client"

import { useQuery } from "@tanstack/react-query"

import { getUsersByCourseIdOptions } from "@/services/backend/user-details"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useUsers = (courseId: string) => {
  return useQuery({
    ...getUsersByCourseIdOptions(assertNotNullOrUndefined(courseId)),
    enabled: !!courseId,
  })
}
