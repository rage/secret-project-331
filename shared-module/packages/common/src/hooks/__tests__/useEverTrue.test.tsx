"use client"

import { renderHook } from "@testing-library/react"

import { useEverTrue } from "../useEverTrue"

describe("useEverTrue", () => {
  it("returns false by default when all flags are false", () => {
    const { result } = renderHook(({ flags }) => useEverTrue(...flags), {
      initialProps: { flags: [false, false, false] as boolean[] },
    })

    expect(result.current).toBe(false)
  })

  it("returns true immediately if any flag is true on first render", () => {
    const { result } = renderHook(({ flags }) => useEverTrue(...flags), {
      initialProps: { flags: [false, true, false] as boolean[] },
    })

    expect(result.current).toBe(true)
  })

  it("latches to true once any flag becomes true on a later render", () => {
    const { result, rerender } = renderHook(({ flags }) => useEverTrue(...flags), {
      initialProps: { flags: [false, false] as boolean[] },
    })

    expect(result.current).toBe(false)

    // A flag becomes true on a later render
    rerender({ flags: [false, true] })

    expect(result.current).toBe(true)

    // Stays true even if all flags go back to false
    rerender({ flags: [false, false] })

    expect(result.current).toBe(true)
  })

  it("handles being called with no args, then becomes true later", () => {
    const { result, rerender } = renderHook(({ flags }) => useEverTrue(...flags), {
      initialProps: { flags: [] as boolean[] },
    })

    expect(result.current).toBe(false)

    rerender({ flags: [true] })

    expect(result.current).toBe(true)
  })

  it("remains true across subsequent renders regardless of inputs", () => {
    const { result, rerender } = renderHook(({ flags }) => useEverTrue(...flags), {
      initialProps: { flags: [false] as boolean[] },
    })

    expect(result.current).toBe(false)

    rerender({ flags: [true] })

    expect(result.current).toBe(true)

    // Even with multiple truthy values after latching
    rerender({ flags: [true, true, true] })

    expect(result.current).toBe(true)

    // And when all return to false
    rerender({ flags: [false, false] })

    expect(result.current).toBe(true)
  })

  it("state is scoped per component instance", () => {
    // First hook instance: flips to true
    const first = renderHook(({ flags }) => useEverTrue(...flags), {
      initialProps: { flags: [false] as boolean[] },
    })
    expect(first.result.current).toBe(false)
    first.rerender({ flags: [true] })

    expect(first.result.current).toBe(true)

    // Second, separate instance: starts fresh (false)
    const second = renderHook(({ flags }) => useEverTrue(...flags), {
      initialProps: { flags: [false] as boolean[] },
    })
    expect(second.result.current).toBe(false)
  })
})
