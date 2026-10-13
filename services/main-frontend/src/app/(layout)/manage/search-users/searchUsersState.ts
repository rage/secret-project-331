import type { UseQueryResult } from "@tanstack/react-query"
import { differenceBy } from "lodash"

import type { FuzzyUserSearchResults, UserDetail } from "@/generated/api/types.generated"

/**
 * What the search page can show for the current query. Exact matches are shown as soon as they
 * arrive and similar users are only ever added below them, so a row never moves once it is visible.
 */
export interface SearchUsersState {
  isSearching: boolean
  /** The exact search for the current query has answered, successfully or not. */
  isExactSettled: boolean
  isFuzzySettled: boolean
  exactUsers: UserDetail[]
  /** Similar users minus the exact matches; `null` until the fuzzy search for this query answers. */
  similarUsers: UserDetail[] | null
  hasMoreSimilar: boolean
  hasSimilarTimedOut: boolean
  exactError: unknown
  fuzzyError: unknown
  /** The previous query's results, shown dimmed until the exact search for this one answers. */
  previous: { exactUsers: UserDetail[]; similarUsers: UserDetail[] } | null
  /** Distinct users found, once both searches have answered. */
  resultCount: number | null
}

const isSettled = (query: UseQueryResult<unknown, unknown>): boolean =>
  query.isError || (query.isSuccess && !query.isPlaceholderData)

export const deriveSearchUsersState = (
  exactQuery: UseQueryResult<UserDetail[], unknown>,
  fuzzyQuery: UseQueryResult<FuzzyUserSearchResults, unknown>,
): SearchUsersState => {
  const isExactSettled = isSettled(exactQuery)
  const isFuzzySettled = isSettled(fuzzyQuery)
  const exactUsers = isExactSettled ? (exactQuery.data ?? []) : []
  const fuzzyResults = isFuzzySettled ? fuzzyQuery.data : undefined
  const similarUsers =
    isFuzzySettled && fuzzyQuery.isSuccess
      ? differenceBy(fuzzyResults?.users ?? [], exactUsers, "user_id")
      : null

  let previous: SearchUsersState["previous"] = null
  if (!isExactSettled && exactQuery.isPlaceholderData) {
    const previousExactUsers = exactQuery.data ?? []
    const previousSimilarUsers = fuzzyQuery.isPlaceholderData
      ? differenceBy(fuzzyQuery.data?.users ?? [], previousExactUsers, "user_id")
      : []
    previous = { exactUsers: previousExactUsers, similarUsers: previousSimilarUsers }
  }

  return {
    isSearching: exactQuery.isFetching || fuzzyQuery.isFetching,
    isExactSettled,
    isFuzzySettled,
    exactUsers,
    similarUsers,
    hasMoreSimilar: fuzzyResults?.has_more ?? false,
    hasSimilarTimedOut: fuzzyResults?.timed_out ?? false,
    exactError: exactQuery.isError ? exactQuery.error : null,
    fuzzyError: fuzzyQuery.isError ? fuzzyQuery.error : null,
    previous,
    resultCount:
      isExactSettled && isFuzzySettled ? exactUsers.length + (similarUsers?.length ?? 0) : null,
  }
}

const PLACEHOLDER_ROW_COUNT = 3

export type ResultRow =
  | { kind: "user"; user: UserDetail; isExact: boolean }
  | { kind: "placeholder"; index: number }

export type ResultsView = "too-short" | "empty" | "table"

const placeholderRows: ResultRow[] = Array.from({ length: PLACEHOLDER_ROW_COUNT }, (_, index) => ({
  kind: "placeholder",
  index,
}))

const userRows = (users: UserDetail[], isExact: boolean): ResultRow[] =>
  users.map((user) => ({ kind: "user", user, isExact }))

/**
 * Table rows for the state: exact matches first, then similar users or placeholder rows standing in
 * for them. Before the exact search answers, the previous results or only placeholders.
 */
export const resultRows = (state: SearchUsersState): ResultRow[] => {
  if (state.previous) {
    return [
      ...userRows(state.previous.exactUsers, true),
      ...userRows(state.previous.similarUsers, false),
    ]
  }
  if (!state.isExactSettled) {
    return placeholderRows
  }
  const similarRows = state.isFuzzySettled
    ? userRows(state.similarUsers ?? [], false)
    : placeholderRows
  return [...userRows(state.exactUsers, true), ...similarRows]
}

export const resultRowKey = (row: ResultRow): string =>
  row.kind === "user" ? row.user.user_id : `placeholder-${row.index}`

export const resultsView = (state: SearchUsersState, isTooShort: boolean): ResultsView => {
  if (isTooShort) {
    return "too-short"
  }
  const isEmpty =
    state.resultCount === 0 && !state.exactError && !state.fuzzyError && !state.hasSimilarTimedOut
  return isEmpty ? "empty" : "table"
}
