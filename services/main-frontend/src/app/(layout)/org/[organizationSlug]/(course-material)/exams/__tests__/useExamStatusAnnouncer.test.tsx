"use client"

import { announce } from "@react-aria/live-announcer"
import { renderHook } from "@testing-library/react"

import useExamStatusAnnouncer from "../useExamStatusAnnouncer"

jest.mock("@react-aria/live-announcer", () => ({ announce: jest.fn() }))

const mockAnnounce = jest.mocked(announce)

describe("useExamStatusAnnouncer", () => {
  beforeEach(() => mockAnnounce.mockClear())

  it("announces nothing while plenty of time is left", () => {
    renderHook(() => useExamStatusAnnouncer(3600, false))
    expect(mockAnnounce).not.toHaveBeenCalled()
  })

  it("announces the time left once at 10 minutes and once at 1 minute", () => {
    const { rerender } = renderHook(({ s }) => useExamStatusAnnouncer(s, false), {
      initialProps: { s: 700 },
    })
    expect(mockAnnounce).not.toHaveBeenCalled()

    rerender({ s: 598 })
    expect(mockAnnounce).toHaveBeenCalledTimes(1)
    expect(mockAnnounce).toHaveBeenLastCalledWith("time-left minutes", "polite")

    rerender({ s: 593 })
    expect(mockAnnounce).toHaveBeenCalledTimes(1)

    rerender({ s: 58 })
    expect(mockAnnounce).toHaveBeenCalledTimes(2)
  })

  it("announces that the exam started", () => {
    renderHook(() => useExamStatusAnnouncer(3600, true))
    expect(mockAnnounce).toHaveBeenCalledWith("exam-started", "polite")
  })
})
