import { act, fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import { CopyButton } from "../CopyButton"

// Helper function for rendering CopyButton with default content
const renderCopyButton = (content = "Test content") => render(<CopyButton content={content} />)

describe("CopyButton", () => {
  const mockContent = "Test content"

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: jest.fn(() => Promise.resolve()),
      },
      configurable: true,
    })
    document.execCommand = jest.fn(() => true)
  })

  it("should render with default state", () => {
    renderCopyButton(mockContent)
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "copy-to-clipboard")
  })

  describe("Clipboard API", () => {
    it("should copy content using Clipboard API and show success state", async () => {
      renderCopyButton(mockContent)
      const button = screen.getByRole("button")

      await act(async () => {
        fireEvent.click(button)
      })

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockContent)
      expect(button).toHaveAttribute("aria-label", "copied")

      // Wait for the success state to revert to default after timeout
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      })
      expect(button).toHaveAttribute("aria-label", "copy-to-clipboard")
    })

    it("should show error state when Clipboard API fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

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
      consoleErrorSpy.mockRestore()
    })
  })

  describe("Fallback copy method", () => {
    beforeEach(() => {
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
      consoleErrorSpy.mockRestore()
    })
  })
})
