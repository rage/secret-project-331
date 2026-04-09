import { queryOptions, useQuery } from "@tanstack/react-query"

import { getBulkUserDetails, getUserDetailsByCourses } from "@/generated/api/sdk.generated"
import type { UserDetail } from "@/generated/api/types.generated"
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

const getUserDetailsQueryOptions = (
  courseIds: string[] | null | undefined,
  userId: string | null | undefined,
) =>
  queryOptions({
    queryKey: ["user-details/user", courseIds, userId],
    queryFn: async (): Promise<UseUserDetailsResult> => {
      try {
        const user = await getUserDetailsByCourses({
          body: {
            user_id: assertNotNullOrUndefined(userId),
            course_ids: assertNotNullOrUndefined(courseIds),
          },
          throwOnError: true,
        })

        return {
          kind: "ok",
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
            kind: "not-found",
            userId: assertNotNullOrUndefined(userId),
          }
        }

        throw error
      }
    },
  })

const getBulkUserDetailsQueryOptions = (
  courseId: string | null | undefined,
  userIds: string[] | null | undefined,
) =>
  queryOptions({
    queryKey: ["user-details/bulk", courseId, userIds],
    queryFn: () =>
      getBulkUserDetails({
        body: {
          user_ids: assertNotNullOrUndefined(userIds),
          course_id: assertNotNullOrUndefined(courseId),
        },
        throwOnError: true,
      }),
  })

export const useUserDetails = (
  courseIds: string[] | null | undefined,
  userId: string | null | undefined,
  options?: UseUserDetailsOptions,
) => {
  return useQuery({
    ...getUserDetailsQueryOptions(courseIds, userId),
    enabled: !!userId && !!courseIds && courseIds.length > 0,
    staleTime: options?.staleTime,
    gcTime: options?.gcTime,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
  })
}

export const useBulkUserDetails = (
  courseId: string | null | undefined,
  userIds: string[] | null | undefined,
) => {
  return useQuery({
    ...getBulkUserDetailsQueryOptions(courseId, userIds),
    enabled: !!courseId && !!userIds && userIds.length > 0,
  })
}

type UseUserDetailsResult = UserDetailsResult
