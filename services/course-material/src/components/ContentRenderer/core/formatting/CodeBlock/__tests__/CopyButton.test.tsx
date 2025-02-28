import { act, fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import { CopyButton } from "../CopyButton"

// Helper function for rendering CopyButton with default content
const renderCopyButton = (content = "Test content") => render(<CopyButton content={content} />)

describe("CopyButton", () => {
  const mockContent = "Test content"

  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: jest.fn(() => Promise.resolve()),
      },
      configurable: true,
    })
    document.execCommand = jest.fn(() => true)
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  it("should render with default state", () => {
    renderCopyButton(mockContent)
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "copy-to-clipboard")
  })

  describe("Clipboard API", () => {
    it("should copy content using Clipboard API and show success state", async () => {
      renderCopyButton(mockContent)
      const button = screen.getByRole("button")

      // Click the copy button
      await act(async () => {
        fireEvent.click(button)
      })

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockContent)
      expect(button).toHaveAttribute("aria-label", "copied")

      // Advance timers by 2000ms to trigger state reset
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      expect(button).toHaveAttribute("aria-label", "copy-to-clipboard")
    })

    it("should show error state when Clipboard API fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

      // Override clipboard mock to force an error
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: jest.fn(() => Promise.reject(new Error("Clipboard error"))),
        },
        configurable: true,
      })
      document.execCommand = jest.fn(() => false)

      renderCopyButton(mockContent)
      const button = screen.getByRole("button")

      await act(async () => {
        fireEvent.click(button)
      })

      expect(button).toHaveAttribute("aria-label", "copying-failed")

      // Advance timers to allow error state to reset
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      expect(button).toHaveAttribute("aria-label", "copy-to-clipboard")
      consoleErrorSpy.mockRestore()
    })
  })

  describe("Fallback copy method", () => {
    beforeEach(() => {
      // Remove the Clipboard API for fallback testing
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      })
    })

    it("should use fallback copy method when Clipboard API is not available", async () => {
      renderCopyButton(mockContent)
      const button = screen.getByRole("button")

      await act(async () => {
        fireEvent.click(button)
      })

      expect(document.execCommand).toHaveBeenCalledWith("copy")
      expect(button).toHaveAttribute("aria-label", "copied")

      // Advance timers to trigger reset of copy status
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      expect(button).toHaveAttribute("aria-label", "copy-to-clipboard")
    })

    it("should show error state when fallback method fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
      document.execCommand = jest.fn(() => false)

      renderCopyButton(mockContent)
      const button = screen.getByRole("button")

      await act(async () => {
        fireEvent.click(button)
      })

      expect(button).toHaveAttribute("aria-label", "copying-failed")

      // Advance timers to allow error state to revert
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      expect(button).toHaveAttribute("aria-label", "copy-to-clipboard")
      consoleErrorSpy.mockRestore()
    })
  })

  it("should copy sanitized code without <br> tags", async () => {
    const contentWithBr = "line1<br>line2<br>line3"
    renderCopyButton(contentWithBr)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("line1\nline2\nline3")

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(button).toHaveAttribute("aria-label", "copy-to-clipboard")
  })

  it("should copy sanitized text for encoded HTML input", async () => {
    const encodedContent = "&lt;html>\n  &lt;p>hello&lt;br>world!&lt;/p>\n&lt;/html>"
    renderCopyButton(encodedContent)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })

    // The parseHtmlToPlainText helper should decode the input and preserve the literal <br> tag
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "<html>\n  <p>hello<br>world!</p>\n</html>",
    )

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(button).toHaveAttribute("aria-label", "copy-to-clipboard")
  })
})
