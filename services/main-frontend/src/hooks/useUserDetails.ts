import { queryOptions, useQuery } from "@tanstack/react-query"

import { getBulkUserDetails, getUserDetailsByCourses } from "@/generated/api/sdk.generated"
import type { UserDetail } from "@/generated/api/types.generated"
import { isAppApiError } from "@/shared-module/common/errors/AppApiError"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

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

/** Returns true when user details query inputs are sufficient to fetch data. */
export const isUserDetailsQueryReady = (
  courseIds: string[] | null | undefined,
  userId: string | null | undefined,
): boolean => {
  return Boolean(userId && courseIds)
}

/** Returns true when a thrown query error represents a not-found user. */
export const isUserDetailsNotFoundError = (error: unknown): boolean => {
  return (
    (isAppApiError(error) &&
      (error.messageKey === "not_found" || error.type === "not_found" || error.status === 404)) ||
    (typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof error.status === "number" &&
      error.status === 404)
  )
}

const getUserDetailsQueryOptions = (courseIds: string[], userId: string) =>
  queryOptions({
    queryKey: ["user-details/user", courseIds, userId],
    queryFn: async (): Promise<UseUserDetailsResult> => {
      try {
        const user = await getUserDetailsByCourses({
          body: {
            user_id: userId,
            course_ids: courseIds,
          },
        })

        return {
          kind: "ok",
          user,
        }
      } catch (error) {
        if (isUserDetailsNotFoundError(error)) {
          return {
            kind: "not-found",
            userId,
          }
        }

        throw error
      }
    },
  })

const getBulkUserDetailsQueryOptions = (courseId: string, userIds: string[]) =>
  queryOptions({
    queryKey: ["user-details/bulk", courseId, userIds],
    queryFn: () =>
      getBulkUserDetails({
        body: {
          user_ids: userIds,
          course_id: courseId,
        },
      }),
  })

export const useUserDetails = (
  courseIds: string[] | null | undefined,
  userId: string | null | undefined,
  options?: UseUserDetailsOptions,
) => {
  return useQuery({
    ...optionalGeneratedQueryOptions({
      value: courseIds && userId ? { courseIds, userId } : null,
      isReady: (
        value,
      ): value is {
        courseIds: string[]
        userId: string
      } => isUserDetailsQueryReady(value?.courseIds, value?.userId),
      build: ({ courseIds: readyCourseIds, userId: readyUserId }) =>
        getUserDetailsQueryOptions(readyCourseIds, readyUserId),
    }),
    staleTime: options?.staleTime,
    gcTime: options?.gcTime,
    refetchOnWindowFocus: options?.refetchOnWindowFocus,
  })
}

export const useBulkUserDetails = (
  courseId: string | null | undefined,
  userIds: string[] | null | undefined,
) => {
  return useQuery(
    optionalGeneratedQueryOptions({
      value: courseId && userIds ? { courseId, userIds } : null,
      isReady: (
        value,
      ): value is {
        courseId: string
        userIds: string[]
      } => Boolean(value?.courseId && value.userIds.length > 0),
      build: ({ courseId: readyCourseId, userIds: readyUserIds }) =>
        getBulkUserDetailsQueryOptions(readyCourseId, readyUserIds),
    }),
  )
}

type UseUserDetailsResult = UserDetailsResult
