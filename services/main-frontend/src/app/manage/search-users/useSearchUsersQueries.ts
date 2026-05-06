"use client"

import { useQuery, type UseQueryResult } from "@tanstack/react-query"

import {
  searchUserDetailsByEmail,
  searchUserDetailsByOtherDetails,
  searchUserDetailsFuzzyMatch,
} from "@/generated/api/sdk.generated"
import type { UserDetail } from "@/generated/api/types.generated"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export interface SearchUsersQueries {
  searchByEmailQuery: UseQueryResult<UserDetail[], unknown>
  searchByOtherDetailsQuery: UseQueryResult<UserDetail[], unknown>
  searchFuzzyMatchQuery: UseQueryResult<UserDetail[], unknown>
}

/** Runs the three user-search API queries for the given executed query string. */
const useSearchUsersQueries = (searchQuery: string): SearchUsersQueries => {
  const hasActiveSearch = searchQuery !== ""

  const searchByEmailQuery = useQuery({
    queryKey: ["searchUsersByEmail", searchQuery],
    queryFn: async () =>
      searchUserDetailsByEmail({
        body: {
          query: assertNotNullOrUndefined(searchQuery),
        },
      }),
    enabled: hasActiveSearch,
  })

  const searchByOtherDetailsQuery = useQuery({
    queryKey: ["searchUsersByOtherDetails", searchQuery],
    queryFn: async () =>
      searchUserDetailsByOtherDetails({
        body: {
          query: assertNotNullOrUndefined(searchQuery),
        },
      }),
    enabled: hasActiveSearch,
  })

  const searchFuzzyMatchQuery = useQuery({
    queryKey: ["searchUsersFuzzyMatch", searchQuery],
    queryFn: async () =>
      searchUserDetailsFuzzyMatch({
        body: {
          query: assertNotNullOrUndefined(searchQuery),
        },
      }),
    enabled: hasActiveSearch,
  })

  return { searchByEmailQuery, searchByOtherDetailsQuery, searchFuzzyMatchQuery }
}

export default useSearchUsersQueries
