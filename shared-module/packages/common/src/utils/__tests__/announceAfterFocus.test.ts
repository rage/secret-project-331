import { announce } from "@react-aria/live-announcer"

import { ANNOUNCE_AFTER_FOCUS_MS, announceAfterFocus } from "../announceAfterFocus"

jest.mock("@react-aria/live-announcer", () => ({ announce: jest.fn() }))

describe("announceAfterFocus", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.mocked(announce).mockClear()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test("waits for the focus speech before announcing", () => {
    announceAfterFocus("Comment added")
    expect(announce).not.toHaveBeenCalled()
    jest.advanceTimersByTime(ANNOUNCE_AFTER_FOCUS_MS)
    expect(announce).toHaveBeenCalledWith("Comment added", "polite")
  })
})
