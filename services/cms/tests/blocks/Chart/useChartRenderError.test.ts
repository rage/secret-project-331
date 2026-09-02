/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals"
import { act, renderHook, waitFor } from "@testing-library/react"

// The hook compiles specs with Vega-Lite, which this environment is missing two browser APIs for:
// structuredClone, and the canvas Vega measures text on. Both have to be in place before the module
// graph loads, hence the dynamic import below.
globalThis.structuredClone ??= (value: unknown) => JSON.parse(JSON.stringify(value))
HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement["getContext"]

const { useChartRenderError } = await import("@/blocks/Chart/useChartRenderError")

// Longer than the hook's own wait for editing to pause.
const PAST_THE_DEBOUNCE_MS = 1000

const RENDERABLE = JSON.stringify({
  mark: "bar",
  data: { url: "/uploads/data.csv" },
  encoding: { x: { field: "a", type: "nominal" } },
})

const settleDebounce = () =>
  act(() => {
    jest.advanceTimersByTime(PAST_THE_DEBOUNCE_MS)
  })

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe("useChartRenderError", () => {
  it("reports nothing for a spec that renders", () => {
    const { result } = renderHook(() => useChartRenderError(RENDERABLE))

    settleDebounce()

    expect(result.current).toBeNull()
  })

  it("reports the parse failure for a spec that isn't JSON", () => {
    const { result } = renderHook(() => useChartRenderError("{ not json"))

    settleDebounce()

    expect(result.current).toEqual(expect.any(String))
    expect(result.current).not.toBe("")
  })

  it("reports a spec that parses but will not compile", () => {
    const brokenEncoding = JSON.stringify({
      mark: "bar",
      data: { url: "/uploads/data.csv" },
      encoding: { x: { field: "a", type: "not-a-type" } },
    })

    const { result } = renderHook(() => useChartRenderError(brokenEncoding))
    settleDebounce()

    expect(result.current).toEqual(expect.any(String))
  })

  it("does not flag a spec that has a data file but no chart written yet", () => {
    const dataOnly = JSON.stringify({ data: { url: "/uploads/data.csv" } })

    const { result } = renderHook(() => useChartRenderError(dataOnly))
    settleDebounce()

    expect(result.current).toBeNull()
  })

  it("reports nothing for an empty or blank spec", () => {
    const { result } = renderHook(() => useChartRenderError(""))
    settleDebounce()
    expect(result.current).toBeNull()

    const blank = renderHook(() => useChartRenderError("   \n"))
    settleDebounce()
    expect(blank.result.current).toBeNull()
  })

  it("reports nothing when there is no spec at all", () => {
    const { result } = renderHook(() => useChartRenderError(undefined))
    settleDebounce()

    expect(result.current).toBeNull()
  })

  it("waits for editing to pause before flagging a half-typed spec", () => {
    const { result } = renderHook(() => useChartRenderError("{ not json"))

    expect(result.current).toBeNull()

    settleDebounce()
    expect(result.current).not.toBeNull()
  })

  it("clears the error once the spec is repaired", async () => {
    const { result, rerender } = renderHook((spec: string) => useChartRenderError(spec), {
      initialProps: "{ not json",
    })
    settleDebounce()
    expect(result.current).not.toBeNull()

    rerender(RENDERABLE)
    settleDebounce()

    await waitFor(() => expect(result.current).toBeNull())
  })
})
