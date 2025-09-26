import { useQuery } from "@tanstack/react-query"

import { getBulkUserDetails, getUserDetails } from "../services/backend/user-details"

import { UserDetail } from "@/shared-module/common/bindings"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useUserDetails = (
  courseIds: string[] | null | undefined,
  userId: string | null | undefined,
) => {
  return useQuery<UserDetail>({
    queryKey: ["user-details/user", courseIds, userId],
    queryFn: () =>
      getUserDetails(assertNotNullOrUndefined(courseIds), assertNotNullOrUndefined(userId)),
    enabled: !!courseIds && !!userId,
  })
}

export const useBulkUserDetails = (
  courseId: string | null | undefined,
  userIds: string[] | null | undefined,
) => {
  return useQuery<UserDetail[]>({
    queryKey: ["user-details/bulk", courseId, userIds],
    queryFn: () =>
      getBulkUserDetails(assertNotNullOrUndefined(courseId), assertNotNullOrUndefined(userIds)),
    enabled: !!courseId && !!userIds && userIds.length > 0,
  })
}
