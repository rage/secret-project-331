"use client"

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query"

import { searchUserDetailsExact, searchUserDetailsFuzzy } from "@/generated/api/sdk.generated"
import type { FuzzyUserSearchResults, UserDetail } from "@/generated/api/types.generated"

/** Matches the backend's minimum for the typo-tolerant search. */
const MIN_SEARCH_TERM_LENGTH = 3

export interface SearchUsersQueries {
  exactQuery: UseQueryResult<UserDetail[], unknown>
  fuzzyQuery: UseQueryResult<FuzzyUserSearchResults, unknown>
}

/** True for a term that cannot match anything, so it is not sent at all. */
export const isSearchTermTooShort = (searchQuery: string): boolean =>
  searchQuery.trim().length < MIN_SEARCH_TERM_LENGTH

/**
 * Runs the exact and the typo-tolerant user search for the executed query string. Both keep the
 * previous query's data as placeholder data while a new query runs, and abort a superseded request.
 */
const useSearchUsersQueries = (searchQuery: string): SearchUsersQueries => {
  const enabled = searchQuery !== "" && !isSearchTermTooShort(searchQuery)

  const exactQuery = useQuery({
    queryKey: ["searchUsersExact", searchQuery],
    queryFn: ({ signal }) => searchUserDetailsExact({ body: { query: searchQuery }, signal }),
    enabled,
    placeholderData: keepPreviousData,
  })

  const fuzzyQuery = useQuery({
    queryKey: ["searchUsersFuzzy", searchQuery],
    queryFn: ({ signal }) => searchUserDetailsFuzzy({ body: { query: searchQuery }, signal }),
    enabled,
    placeholderData: keepPreviousData,
  })

  return { exactQuery, fuzzyQuery }
}

export default useSearchUsersQueries
