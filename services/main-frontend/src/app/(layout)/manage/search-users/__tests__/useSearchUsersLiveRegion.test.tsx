"use client"

import { renderHook } from "@testing-library/react"

import type { FuzzyUserSearchResults, UserDetail } from "@/generated/api/types.generated"

import {
  createUser,
  failed,
  fetching,
  fuzzyResults,
  succeeded,
} from "../__fixtures__/queryFixtures"
import { deriveSearchUsersState } from "../searchUsersState"
import useSearchUsersLiveRegion from "../useSearchUsersLiveRegion"

const oneResult = deriveSearchUsersState(
  succeeded([createUser("user-1")]),
  succeeded(fuzzyResults([])),
)

describe("useSearchUsersLiveRegion", () => {
  it("clears stale announcements when search is cleared", () => {
    const { result, rerender } = renderHook(
      ({ searchQuery }) =>
        useSearchUsersLiveRegion({ searchQuery, isTooShort: false, state: oneResult }),
      { initialProps: { searchQuery: "alice" } },
    )

    expect(result.current).toBe("search-users-live-region-one-result-found")

    rerender({ searchQuery: "" })

    expect(result.current).toBe("")

    rerender({ searchQuery: "bob" })

    expect(result.current).toBe("search-users-live-region-one-result-found")
  })

  it("does not announce a result count while the similar-user search runs", () => {
    const state = deriveSearchUsersState(
      succeeded([createUser("user-1")]),
      fetching<FuzzyUserSearchResults>(),
    )

    const { result } = renderHook(() =>
      useSearchUsersLiveRegion({ searchQuery: "alice", isTooShort: false, state }),
    )

    expect(result.current).toBe("search-users-live-region-searching-users")
  })

  it("announces a too short term", () => {
    const state = deriveSearchUsersState(succeeded<UserDetail[]>([]), succeeded(fuzzyResults([])))

    const { result } = renderHook(() =>
      useSearchUsersLiveRegion({ searchQuery: "al", isTooShort: true, state }),
    )

    expect(result.current).toBe("search-users-too-short")
  })

  it("announces a failed search", () => {
    const state = deriveSearchUsersState(succeeded([createUser("user-1")]), failed())

    const { result } = renderHook(() =>
      useSearchUsersLiveRegion({ searchQuery: "alice", isTooShort: false, state }),
    )

    expect(result.current).toBe("search-users-live-region-search-failed")
  })
})
