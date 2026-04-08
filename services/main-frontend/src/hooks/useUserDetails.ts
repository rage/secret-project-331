import { useQuery } from "@tanstack/react-query"

import { getBulkUserDetails, getUserDetails } from "../services/backend/user-details"

import type { UserDetail } from "@/shared-module/common/bindings"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export interface UseUserDetailsOptions {
  staleTime?: number
  gcTime?: number
  refetchOnWindowFocus?: boolean
}

export type UserDetailsResult =
  | {
      kind: "ok"
      user: UserDetail
    }
  | {
      kind: "not-found"
      userId: string
    }

export const extractUserDetail = (
  result: UserDetailsResult | null | undefined,
): UserDetail | null => {
  if (result?.kind === "ok") {
    return result.user
  }
  return null
}

export const isUserDetailsNotFound = (
  result: UserDetailsResult | null | undefined,
): result is { kind: "not-found"; userId: string } => {
  return result?.kind === "not-found"
}

export const useUserDetails = (
  courseIds: string[] | null | undefined,
  userId: string | null | undefined,
  options?: UseUserDetailsOptions,
) => {
  return useQuery<UserDetailsResult>({
    queryKey: ["user-details/user", courseIds, userId],
    queryFn: async () => {
      const safeCourseIds = assertNotNullOrUndefined(courseIds)
      const safeUserId = assertNotNullOrUndefined(userId)

      try {
        const user = await getUserDetails(safeCourseIds, safeUserId)
        return {
          kind: "ok" as const,
          user,
        }
      } catch (error) {
        const message =
          typeof error === "string"
            ? error
            : typeof error === "object" &&
                error !== null &&
                "message" in error &&
                typeof error.message === "string"
              ? error.message
              : JSON.stringify(error)

        if (message.includes("RecordNotFound")) {
          return {
            kind: "not-found" as const,
            userId: safeUserId,
          }
        }

        // For all other failures, surface a real error to the caller
        throw error
      }
    },
    enabled: !!courseIds && !!userId,
    staleTime: options?.staleTime,
    gcTime: options?.gcTime,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
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
