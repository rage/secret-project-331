import { act, renderHook } from "@testing-library/react"

import { useLoadingAffordance } from "../src/lib/utils/loading"
import { LOADING_AFFORDANCE_DELAY_MS, MIN_VISIBLE_MS } from "../src/styles/motion"

describe("useLoadingAffordance", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test("stays hidden until delayMs elapses, then shows", () => {
    const { result } = renderHook(() =>
      useLoadingAffordance(true, { delayMs: 250, minVisibleMs: 0 }),
    )

    expect(result.current).toBe(false)
    act(() => {
      jest.advanceTimersByTime(249)
    })
    expect(result.current).toBe(false)
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe(true)
  })

  test("never shows when isPending resolves before the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ isPending }) => useLoadingAffordance(isPending, { delayMs: 250, minVisibleMs: 400 }),
      { initialProps: { isPending: true } },
    )

    act(() => {
      jest.advanceTimersByTime(100)
    })
    rerender({ isPending: false })
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(result.current).toBe(false)
  })

  test("once shown, stays visible for minVisibleMs after isPending resolves", () => {
    const { result, rerender } = renderHook(
      ({ isPending }) => useLoadingAffordance(isPending, { delayMs: 100, minVisibleMs: 400 }),
      { initialProps: { isPending: true } },
    )

    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(result.current).toBe(true)

    rerender({ isPending: false })
    act(() => {
      jest.advanceTimersByTime(399)
    })
    expect(result.current).toBe(true)

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe(false)
  })

  test("hides immediately once minVisibleMs has already elapsed while still pending", () => {
    const { result, rerender } = renderHook(
      ({ isPending }) => useLoadingAffordance(isPending, { delayMs: 100, minVisibleMs: 400 }),
      { initialProps: { isPending: true } },
    )

    act(() => {
      jest.advanceTimersByTime(600)
    })
    expect(result.current).toBe(true)

    rerender({ isPending: false })
    expect(result.current).toBe(false)
  })

  test("defaults to the package's loading-affordance delay and min-visible constants", () => {
    const { result, rerender } = renderHook(({ isPending }) => useLoadingAffordance(isPending), {
      initialProps: { isPending: true },
    })

    act(() => {
      jest.advanceTimersByTime(LOADING_AFFORDANCE_DELAY_MS - 1)
    })
    expect(result.current).toBe(false)
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe(true)

    rerender({ isPending: false })
    act(() => {
      jest.advanceTimersByTime(MIN_VISIBLE_MS - 1)
    })
    expect(result.current).toBe(true)
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe(false)
  })
})
