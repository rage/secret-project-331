import { act, fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import { CopyButton } from "../CopyButton"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

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

  afterEach(() => {
    jest.resetAllMocks()
  })

  it("renders with initial state", () => {
    render(<CopyButton content={mockContent} />)
    expect(screen.getByRole("button")).toHaveAttribute("aria-label", "copy-to-clipboard")
  })

  describe("Clipboard API", () => {
    it("copies content using Clipboard API and shows success state", async () => {
      render(<CopyButton content={mockContent} />)
      const button = screen.getByRole("button")

      await act(async () => {
        fireEvent.click(button)
      })

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockContent)
      expect(button).toHaveAttribute("aria-label", "copied")

      // Wait for the success state to disappear
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      })
      expect(button).toHaveAttribute("aria-label", "copy-to-clipboard")
    })

    it("shows error state when clipboard API fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: jest.fn(() => Promise.reject(new Error("Clipboard error"))),
        },
        configurable: true,
      })
      document.execCommand = jest.fn(() => false)

      render(<CopyButton content={mockContent} />)
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

    it("uses fallback copy method when Clipboard API is not available", async () => {
      render(<CopyButton content={mockContent} />)
      const button = screen.getByRole("button")

      await act(async () => {
        fireEvent.click(button)
      })

      expect(document.execCommand).toHaveBeenCalledWith("copy")
      expect(button).toHaveAttribute("aria-label", "copied")
    })

    it("shows error state when fallback method fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})

      document.execCommand = jest.fn(() => false)

      render(<CopyButton content={mockContent} />)
      const button = screen.getByRole("button")

      await act(async () => {
        fireEvent.click(button)
      })

      expect(button).toHaveAttribute("aria-label", "copying-failed")
      consoleErrorSpy.mockRestore()
    })
  })
})
