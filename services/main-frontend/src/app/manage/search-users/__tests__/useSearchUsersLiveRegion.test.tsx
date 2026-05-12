"use client"

import type { UseQueryResult } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"

import useSearchUsersLiveRegion from "../useSearchUsersLiveRegion"

import type { UserDetail } from "@/generated/api/types.generated"

const createUser = (user_id: string): UserDetail =>
  ({
    user_id,
  }) as UserDetail

const createQuery = (
  overrides: Partial<UseQueryResult<UserDetail[], unknown>> = {},
): UseQueryResult<UserDetail[], unknown> =>
  ({
    data: [],
    isError: false,
    isFetching: false,
    isPending: false,
    ...overrides,
  }) as UseQueryResult<UserDetail[], unknown>

describe("useSearchUsersLiveRegion", () => {
  it("clears stale announcements when search is cleared", () => {
    const idleQuery = createQuery()
    const resultQuery = createQuery({ data: [createUser("user-1")] })

    const { result, rerender } = renderHook(
      ({ searchQuery }) =>
        useSearchUsersLiveRegion({
          searchQuery,
          searchByEmailQuery: resultQuery,
          searchByOtherDetailsQuery: idleQuery,
          searchFuzzyMatchQuery: idleQuery,
        }),
      { initialProps: { searchQuery: "alice" } },
    )

    expect(result.current).toBe("search-users-live-region-one-result-found")

    rerender({ searchQuery: "" })

    expect(result.current).toBe("")

    rerender({ searchQuery: "bob" })

    expect(result.current).toBe("search-users-live-region-one-result-found")
  })

  it("does not announce disabled queries as still searching", () => {
    const settledQuery = createQuery()
    const disabledPendingQuery = createQuery({ data: undefined, isPending: true })

    const { result } = renderHook(() =>
      useSearchUsersLiveRegion({
        searchQuery: "al",
        searchByEmailQuery: settledQuery,
        searchByOtherDetailsQuery: settledQuery,
        searchFuzzyMatchQuery: disabledPendingQuery,
      }),
    )

    expect(result.current).toBe("search-users-live-region-no-users-found")
  })

  it("does not announce no users found while a query is still fetching", () => {
    const settledQuery = createQuery()
    const fetchingQuery = createQuery({ data: undefined, isFetching: true, isPending: true })

    const { result } = renderHook(() =>
      useSearchUsersLiveRegion({
        searchQuery: "alice",
        searchByEmailQuery: settledQuery,
        searchByOtherDetailsQuery: fetchingQuery,
        searchFuzzyMatchQuery: settledQuery,
      }),
    )

    expect(result.current).toBe("search-users-live-region-searching-users")
  })

  it("does not announce final result counts while a query is still fetching", () => {
    const resultQuery = createQuery({ data: [createUser("user-1")] })
    const fetchingQuery = createQuery({ data: undefined, isFetching: true, isPending: true })

    const { result } = renderHook(() =>
      useSearchUsersLiveRegion({
        searchQuery: "alice",
        searchByEmailQuery: resultQuery,
        searchByOtherDetailsQuery: fetchingQuery,
        searchFuzzyMatchQuery: createQuery(),
      }),
    )

    expect(result.current).toBe("search-users-live-region-searching-users")
  })
})
