/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals"
import { act, renderHook } from "@testing-library/react"

import { useDataFileDetachedNotice } from "../../../src/blocks/Chart/useDataFileDetachedNotice"

const DATA_URL = "/uploads/data.csv"

// Longer than the hook's own wait for editing to pause.
const PAST_THE_PAUSE_MS = 1000

const withData = JSON.stringify({ mark: "bar", data: { url: DATA_URL } })
const withoutData = JSON.stringify({ mark: "bar" })

const renderNotice = (spec: string, dataFileUrl: string | undefined) =>
  renderHook(
    ({ spec: currentSpec }: { spec: string }) =>
      useDataFileDetachedNotice({ spec: currentSpec, dataFileUrl }),
    { initialProps: { spec } },
  )

const waitForThePause = () =>
  act(() => {
    jest.advanceTimersByTime(PAST_THE_PAUSE_MS)
  })

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe("useDataFileDetachedNotice", () => {
  it("says nothing while the spec still reads the file", () => {
    const { result } = renderNotice(withData, DATA_URL)

    waitForThePause()

    expect(result.current.isDetached).toBe(false)
  })

  it("offers the file back once an edit has left it unused", () => {
    const { result, rerender } = renderNotice(withData, DATA_URL)

    rerender({ spec: withoutData })
    expect(result.current.isDetached).toBe(false)

    waitForThePause()
    expect(result.current.isDetached).toBe(true)
  })

  it("does not flash the offer while a data block is being retyped", () => {
    const { result, rerender } = renderNotice(withoutData, DATA_URL)
    waitForThePause()
    expect(result.current.isDetached).toBe(true)

    // Typing the data back withdraws the offer at once, rather than after another pause.
    rerender({ spec: withData })
    expect(result.current.isDetached).toBe(false)
  })

  it("says nothing for a spec that isn't valid JSON, since mid-edit text proves nothing", () => {
    const { result } = renderNotice("{ not json", DATA_URL)

    waitForThePause()

    expect(result.current.isDetached).toBe(false)
  })

  it("counts an empty spec as having lost the file", () => {
    const { result } = renderNotice("", DATA_URL)

    waitForThePause()

    expect(result.current.isDetached).toBe(true)
  })

  it("says nothing when no file is attached in the first place", () => {
    const { result } = renderNotice(withoutData, undefined)

    waitForThePause()

    expect(result.current.isDetached).toBe(false)
  })

  it("finds data a multi-view spec declares only on its sub-views", () => {
    const multiView = JSON.stringify({
      hconcat: [{ mark: "bar", data: { url: DATA_URL } }, { mark: "line" }],
    })
    const { result } = renderNotice(multiView, DATA_URL)

    waitForThePause()

    expect(result.current.isDetached).toBe(false)
  })

  describe("confirming a restore", () => {
    it("announces the restore, then stops after a while so the notice does not linger", () => {
      const { result } = renderNotice(withData, DATA_URL)

      act(() => result.current.confirmRestore())
      expect(result.current.restoreConfirmed).toBe(true)

      act(() => {
        jest.advanceTimersByTime(4000)
      })
      expect(result.current.restoreConfirmed).toBe(true)

      act(() => {
        jest.advanceTimersByTime(1000)
      })
      expect(result.current.restoreConfirmed).toBe(false)
    })
  })
})
