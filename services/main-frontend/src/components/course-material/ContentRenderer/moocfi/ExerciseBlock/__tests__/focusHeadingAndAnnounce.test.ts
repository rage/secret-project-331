import { announce } from "@react-aria/live-announcer"

import { ANNOUNCE_AFTER_FOCUS_MS } from "@/shared-module/common/utils/announceAfterFocus"

import { focusHeadingAndAnnounce } from "../focusHeadingAndAnnounce"

jest.mock("@react-aria/live-announcer", () => ({ announce: jest.fn() }))

describe("focusHeadingAndAnnounce", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.mocked(announce).mockClear()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test("focuses the heading first and announces after the focus delay", () => {
    const heading = document.createElement("h2")
    heading.tabIndex = -1
    document.body.append(heading)
    const calls: string[] = []
    jest.mocked(announce).mockImplementation(() => {
      calls.push(`announce:${document.activeElement === heading}`)
    })
    heading.addEventListener("focus", () => calls.push("focus"))

    focusHeadingAndAnnounce(heading, "Answer submitted. You received 1 out of 2 points.")

    expect(calls).toEqual(["focus"])
    expect(announce).not.toHaveBeenCalled()
    jest.advanceTimersByTime(ANNOUNCE_AFTER_FOCUS_MS)
    expect(calls).toEqual(["focus", "announce:true"])
    expect(announce).toHaveBeenCalledWith(
      "Answer submitted. You received 1 out of 2 points.",
      "polite",
    )
    heading.remove()
  })

  test("still announces when there is no heading", () => {
    focusHeadingAndAnnounce(null, "Answer submitted.")
    jest.advanceTimersByTime(ANNOUNCE_AFTER_FOCUS_MS)
    expect(announce).toHaveBeenCalledWith("Answer submitted.", "polite")
  })
})
