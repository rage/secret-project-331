import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { testRuns } from "./testRuns"

const RESULT = { status: "PASSED" as const, testResults: [], logs: {} }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("testRuns store", () => {
  it("returns null for a pending run and the result once set", () => {
    testRuns.set("run-1", null)
    expect(testRuns.get("run-1")).toBeNull()
    testRuns.set("run-1", RESULT)
    expect(testRuns.get("run-1")).toEqual(RESULT)
  })

  it("returns undefined for an unknown id", () => {
    expect(testRuns.get("does-not-exist")).toBeUndefined()
  })

  it("expires entries after the TTL", () => {
    testRuns.set("run-2", RESULT)
    vi.advanceTimersByTime(11 * 60 * 1000)
    expect(testRuns.get("run-2")).toBeUndefined()
  })

  it("keeps the original creation time while a run is pending", () => {
    testRuns.set("run-3", null)
    // Re-setting to pending later must not reset the TTL clock.
    vi.advanceTimersByTime(9 * 60 * 1000)
    testRuns.set("run-3", null)
    vi.advanceTimersByTime(2 * 60 * 1000)
    expect(testRuns.get("run-3")).toBeUndefined()
  })
})
