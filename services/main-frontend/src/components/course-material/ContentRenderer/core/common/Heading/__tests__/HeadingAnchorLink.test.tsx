"use client"

import { act, fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import HeadingAnchorLink from "../HeadingAnchorLink"

const ANCHOR_ID = "3f2b8c1a-when-connection-is-opened"
const FEEDBACK_VISIBLE_MS = 2000

const renderLink = () =>
  render(<HeadingAnchorLink anchorId={ANCHOR_ID} headingText="When connection is opened" />)

const anchorUrl = () => new URL(`#${ANCHOR_ID}`, window.location.href).href

const clickLink = async (init?: Partial<MouseEventInit>) => {
  // oxlint-disable-next-line require-await -- async selects act()'s async flush path
  await act(async () => {
    fireEvent.click(screen.getByRole("link"), init)
  })
}

describe("HeadingAnchorLink", () => {
  const originalConsole = { warn: console.warn, error: console.error, info: console.info }

  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    window.history.replaceState(null, "", "/")
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: jest.fn(() => Promise.resolve()) },
      configurable: true,
    })
    document.execCommand = jest.fn(() => true)
    console.warn = jest.fn()
    console.error = jest.fn()
    console.info = jest.fn()
  })

  afterEach(() => {
    console.warn = originalConsole.warn
    console.error = originalConsole.error
    console.info = originalConsole.info
    jest.restoreAllMocks()
    jest.clearAllTimers()
  })

  it("renders a link to the anchor", () => {
    renderLink()
    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("href", `#${ANCHOR_ID}`)
    expect(link).toHaveAttribute("aria-label", "copy-link-to-section")
  })

  it("copies the absolute link rather than following it", async () => {
    renderLink()
    await clickLink()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(anchorUrl())
    expect(screen.getByRole("link")).toHaveAttribute("data-status", "success")
  })

  it("reflects the section in the address bar", async () => {
    renderLink()
    await clickLink()

    expect(window.location.hash).toBe(`#${ANCHOR_ID}`)
  })

  it("announces the confirmation without renaming the link", async () => {
    renderLink()
    await clickLink()

    expect(screen.getByRole("status")).toHaveTextContent("copied")
    // The link keeps its own name: a control should not be renamed to a status message.
    expect(screen.getByRole("link")).toHaveAttribute("aria-label", "copy-link-to-section")
  })

  it("reports a failure when neither copy method works", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: jest.fn(() => Promise.reject(new Error("Clipboard failed"))) },
      configurable: true,
    })
    document.execCommand = jest.fn(() => false)

    renderLink()
    await clickLink()

    expect(screen.getByRole("status")).toHaveTextContent("copying-failed")
    expect(screen.getByRole("link")).toHaveAttribute("data-status", "error")
  })

  it("clears the confirmation once the feedback window has passed", async () => {
    renderLink()
    await clickLink()

    act(() => {
      jest.advanceTimersByTime(FEEDBACK_VISIBLE_MS)
    })

    expect(screen.getByRole("status")).toBeEmptyDOMElement()
    expect(screen.getByRole("link")).toHaveAttribute("data-status", "default")
  })

  it("restarts the feedback window when the link is copied again", async () => {
    renderLink()
    await clickLink()
    act(() => {
      jest.advanceTimersByTime(FEEDBACK_VISIBLE_MS - 500)
    })
    await clickLink()
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(screen.getByRole("status")).toHaveTextContent("copied")
    expect(screen.getByRole("link")).toHaveAttribute("data-status", "success")
  })

  it("leaves a modified click to the browser", async () => {
    renderLink()
    await clickLink({ ctrlKey: true })

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(screen.getByRole("link")).toHaveAttribute("data-status", "default")
  })
})
