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
})
