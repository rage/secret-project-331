"use client"

import { act, renderHook } from "@testing-library/react"

const mockNavigation = {
  pathname: "/manage/search-users",
  replace: jest.fn(),
  search: "",
}

type JestWithMockModule = typeof jest & {
  unstable_mockModule: (moduleName: string, moduleFactory: () => unknown) => typeof jest
}

const jestWithMockModule = jest as JestWithMockModule

jestWithMockModule.unstable_mockModule("next/navigation", () => ({
  usePathname: () => mockNavigation.pathname,
  useRouter: () => ({ replace: mockNavigation.replace }),
  useSearchParams: () => new URLSearchParams(mockNavigation.search),
}))

const { default: useUrlSyncedDebouncedQuery } = await import("../useUrlSyncedDebouncedQuery")

const renderDebouncedQueryHook = () =>
  renderHook(() =>
    useUrlSyncedDebouncedQuery({
      paramName: "search",
      delayMs: 250,
    }),
  )

describe("useUrlSyncedDebouncedQuery", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockNavigation.search = ""
    mockNavigation.replace.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("runs an immediate search without being reset by the stale debounce value", () => {
    const { result } = renderDebouncedQueryHook()

    act(() => {
      result.current.setInputValue("alice")
    })
    act(() => {
      result.current.runImmediate()
    })

    expect(result.current.queryValue).toBe("alice")
    expect(mockNavigation.replace).toHaveBeenLastCalledWith("/manage/search-users?search=alice")

    act(() => {
      jest.advanceTimersByTime(249)
    })

    expect(result.current.queryValue).toBe("alice")

    act(() => {
      jest.advanceTimersByTime(1)
    })

    expect(result.current.queryValue).toBe("alice")
  })

  it("still runs a search after the debounce delay", () => {
    const { result } = renderDebouncedQueryHook()

    act(() => {
      result.current.setInputValue("bob")
    })

    expect(result.current.queryValue).toBe("")

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(result.current.queryValue).toBe("bob")
    expect(mockNavigation.replace).toHaveBeenLastCalledWith("/manage/search-users?search=bob")
  })

  it("loads same-route URL search changes instead of restoring stale state", () => {
    mockNavigation.search = "search=alice"
    const { result, rerender } = renderDebouncedQueryHook()

    expect(result.current.inputValue).toBe("alice")
    expect(result.current.queryValue).toBe("alice")

    act(() => {
      mockNavigation.search = "search=bob"
      rerender()
    })

    expect(result.current.inputValue).toBe("bob")
    expect(result.current.queryValue).toBe("bob")
    expect(mockNavigation.replace).not.toHaveBeenCalled()
  })

  it("does not overwrite in-progress input when the URL update lands late", () => {
    const { result, rerender } = renderDebouncedQueryHook()

    act(() => {
      result.current.setInputValue("alice")
    })

    act(() => {
      jest.advanceTimersByTime(250)
    })

    expect(result.current.queryValue).toBe("alice")
    expect(mockNavigation.replace).toHaveBeenLastCalledWith("/manage/search-users?search=alice")

    act(() => {
      result.current.setInputValue("alicex")
    })

    act(() => {
      mockNavigation.search = "search=alice"
      rerender()
    })

    expect(result.current.inputValue).toBe("alicex")
  })
})
