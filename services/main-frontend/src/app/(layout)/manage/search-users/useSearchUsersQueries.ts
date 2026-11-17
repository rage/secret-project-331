"use client"

import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query"

import { searchUserDetailsExact, searchUserDetailsFuzzy } from "@/generated/api/sdk.generated"
import type { FuzzyUserSearchResults, UserDetail } from "@/generated/api/types.generated"

/** Matches MIN_FUZZY_SEARCH_TERM_LENGTH in the headless-lms user_details model. */
const MIN_FUZZY_SEARCH_TERM_LENGTH = 3

const NO_SIMILAR_USERS: FuzzyUserSearchResults = { users: [], has_more: false }

export interface SearchUsersQueries {
  exactQuery: UseQueryResult<UserDetail[], unknown>
  fuzzyQuery: UseQueryResult<FuzzyUserSearchResults, unknown>
}

const isTooShortForFuzzySearch = (searchQuery: string): boolean =>
  searchQuery.trim().length < MIN_FUZZY_SEARCH_TERM_LENGTH

/**
 * True for a term that cannot match anything, so it is not sent at all. An all-digit term may be
 * a TMC id, which the exact search matches at any length.
 */
export const isSearchTermTooShort = (searchQuery: string): boolean =>
  !/^\d+$/.test(searchQuery.trim()) && isTooShortForFuzzySearch(searchQuery)

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
    queryFn: ({ signal }) =>
      isTooShortForFuzzySearch(searchQuery)
        ? Promise.resolve(NO_SIMILAR_USERS)
        : searchUserDetailsFuzzy({ body: { query: searchQuery }, signal }),
    enabled,
    placeholderData: keepPreviousData,
  })

  return { exactQuery, fuzzyQuery }
}

export default useSearchUsersQueries
