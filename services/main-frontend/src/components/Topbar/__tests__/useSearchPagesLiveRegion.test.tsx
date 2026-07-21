"use client"

import { renderHook } from "@testing-library/react"

import useSearchPagesLiveRegion from "../useSearchPagesLiveRegion"

describe("useSearchPagesLiveRegion", () => {
  it("announces nothing while the query is empty", () => {
    const { result } = renderHook(() =>
      useSearchPagesLiveRegion({
        searchQuery: "",
        isLoading: false,
        isError: false,
        resultCount: null,
      }),
    )
    expect(result.current).toBe("")
  })

  it("announces a single result with the singular key", () => {
    const { result } = renderHook(() =>
      useSearchPagesLiveRegion({
        searchQuery: "cell",
        isLoading: false,
        isError: false,
        resultCount: 1,
      }),
    )
    expect(result.current).toBe("search-pages-live-region-one-result-found")
  })

  it("announces multiple results with the plural key", () => {
    const { result } = renderHook(() =>
      useSearchPagesLiveRegion({
        searchQuery: "cell",
        isLoading: false,
        isError: false,
        resultCount: 5,
      }),
    )
    expect(result.current).toBe("search-pages-live-region-many-results-found")
  })

  it("announces no results", () => {
    const { result } = renderHook(() =>
      useSearchPagesLiveRegion({
        searchQuery: "zzz",
        isLoading: false,
        isError: false,
        resultCount: 0,
      }),
    )
    expect(result.current).toBe("search-pages-live-region-no-results-found")
  })

  it("announces failure on error", () => {
    const { result } = renderHook(() =>
      useSearchPagesLiveRegion({
        searchQuery: "cell",
        isLoading: false,
        isError: true,
        resultCount: null,
      }),
    )
    expect(result.current).toBe("search-pages-live-region-search-failed")
  })

  it("announces searching while loading a fresh query", () => {
    const { result } = renderHook(() =>
      useSearchPagesLiveRegion({
        searchQuery: "cell",
        isLoading: true,
        isError: false,
        resultCount: null,
      }),
    )
    expect(result.current).toBe("search-pages-live-region-searching")
  })

  it("does not announce the previous query's count when the query changes before loading starts", () => {
    const { result, rerender } = renderHook((props) => useSearchPagesLiveRegion(props), {
      initialProps: {
        searchQuery: "cell",
        isLoading: false,
        isError: false,
        resultCount: 3 as number | null,
      },
    })

    expect(result.current).toBe("search-pages-live-region-many-results-found")

    // resultCount here still holds query A's results, since the fetch effect that flips
    // isLoading runs after the live-region effect; the stale count must NOT be announced.
    rerender({ searchQuery: "cells", isLoading: false, isError: false, resultCount: 3 })
    expect(result.current).toBe("search-pages-live-region-searching")

    rerender({ searchQuery: "cells", isLoading: true, isError: false, resultCount: 3 })
    expect(result.current).toBe("search-pages-live-region-searching")

    rerender({ searchQuery: "cells", isLoading: false, isError: false, resultCount: 1 })
    expect(result.current).toBe("search-pages-live-region-one-result-found")
  })

  it("re-announces an identical count for a new query", () => {
    const { result, rerender } = renderHook((props) => useSearchPagesLiveRegion(props), {
      initialProps: {
        searchQuery: "cell",
        isLoading: false,
        isError: false,
        resultCount: 3 as number | null,
      },
    })
    expect(result.current).toBe("search-pages-live-region-many-results-found")

    rerender({ searchQuery: "cells", isLoading: false, isError: false, resultCount: 3 })
    expect(result.current).toBe("search-pages-live-region-searching")
    rerender({ searchQuery: "cells", isLoading: true, isError: false, resultCount: 3 })

    // The dedup ref was reset on query change, so the same count is announced again.
    rerender({ searchQuery: "cells", isLoading: false, isError: false, resultCount: 3 })
    expect(result.current).toBe("search-pages-live-region-many-results-found")
  })

  it("announces failure when a new query errors", () => {
    const { result, rerender } = renderHook((props) => useSearchPagesLiveRegion(props), {
      initialProps: {
        searchQuery: "cell",
        isLoading: false,
        isError: false,
        resultCount: 3 as number | null,
      },
    })

    rerender({ searchQuery: "cells", isLoading: false, isError: false, resultCount: 3 })
    rerender({ searchQuery: "cells", isLoading: true, isError: false, resultCount: 3 })
    rerender({ searchQuery: "cells", isLoading: false, isError: true, resultCount: 3 })
    expect(result.current).toBe("search-pages-live-region-search-failed")
  })

  it("clears stale announcements when the query is cleared", () => {
    const { result, rerender } = renderHook(
      ({ searchQuery, resultCount }) =>
        useSearchPagesLiveRegion({
          searchQuery,
          isLoading: false,
          isError: false,
          resultCount,
        }),
      { initialProps: { searchQuery: "cell", resultCount: 1 as number | null } },
    )

    expect(result.current).toBe("search-pages-live-region-one-result-found")

    rerender({ searchQuery: "", resultCount: null })

    expect(result.current).toBe("")
  })
})
