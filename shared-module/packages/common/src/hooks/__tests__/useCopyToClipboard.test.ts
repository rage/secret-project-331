import { renderHook } from "@testing-library/react"

import { useCopyToClipboard } from "../useCopyToClipboard"

describe("useCopyToClipboard", () => {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  }

  beforeEach(() => {
    // Mock clipboard API
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: jest.fn(() => Promise.resolve()),
      },
      configurable: true,
    })

    // Mock execCommand for fallback
    document.execCommand = jest.fn(() => true)

    // Silence console methods
    console.log = jest.fn()
    console.warn = jest.fn()
    console.error = jest.fn()
    console.info = jest.fn()
  })

  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log
    console.warn = originalConsole.warn
    console.error = originalConsole.error
    console.info = originalConsole.info
    jest.restoreAllMocks()
  })

  it("should handle basic text copying", async () => {
    const { result } = renderHook(() => useCopyToClipboard("Hello world"))
    const copyToClipboard = result.current

    const success = await copyToClipboard()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Hello world")
    expect(success).toBe(true)
  })

  it("should copy text with special characters", async () => {
    const { result } = renderHook(() => useCopyToClipboard("Text with\nnewlines\tand\ttabs"))
    const copyToClipboard = result.current

    const success = await copyToClipboard()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Text with\nnewlines\tand\ttabs")
    expect(success).toBe(true)
  })

  it("should copy empty string", async () => {
    const { result } = renderHook(() => useCopyToClipboard(""))
    const copyToClipboard = result.current

    const success = await copyToClipboard()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("")
    expect(success).toBe(true)
  })

  it("should update when text changes", async () => {
    const { result, rerender } = renderHook(({ text }) => useCopyToClipboard(text), {
      initialProps: { text: "First text" },
    })

    const copyToClipboard1 = result.current
    await copyToClipboard1()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("First text")

    rerender({ text: "Second text" })
    const copyToClipboard2 = result.current
    await copyToClipboard2()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Second text")
  })

  describe("Fallback behavior", () => {
    it("should use fallback when Clipboard API fails", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: jest.fn(() => Promise.reject(new Error("Clipboard failed"))),
        },
        configurable: true,
      })

      const { result } = renderHook(() => useCopyToClipboard("Test content"))
      const copyToClipboard = result.current

      const success = await copyToClipboard()

      expect(document.execCommand).toHaveBeenCalledWith("copy")
      expect(success).toBe(true)
    })

    it("should use fallback when Clipboard API is not available", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      })

      const { result } = renderHook(() => useCopyToClipboard("Test content"))
      const copyToClipboard = result.current

      const success = await copyToClipboard()

      expect(document.execCommand).toHaveBeenCalledWith("copy")
      expect(success).toBe(true)
    })

    it("should return false when both clipboard methods fail", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: jest.fn(() => Promise.reject(new Error("Clipboard failed"))),
        },
        configurable: true,
      })
      document.execCommand = jest.fn(() => false)

      const { result } = renderHook(() => useCopyToClipboard("Test content"))
      const copyToClipboard = result.current

      const success = await copyToClipboard()

      expect(success).toBe(false)
    })

    it("should handle NotAllowedError and fallback", async () => {
      const notAllowedError = new Error("Permission denied")
      notAllowedError.name = "NotAllowedError"

      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: jest.fn(() => Promise.reject(notAllowedError)),
        },
        configurable: true,
      })

      const { result } = renderHook(() => useCopyToClipboard("Test content"))
      const copyToClipboard = result.current

      const success = await copyToClipboard()

      expect(document.execCommand).toHaveBeenCalledWith("copy")
      expect(success).toBe(true)
    })

    it("should handle non-secure context and fallback", async () => {
      Object.defineProperty(window, "isSecureContext", {
        value: false,
        configurable: true,
      })

      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: jest.fn(() => Promise.reject(new Error("Not secure"))),
        },
        configurable: true,
      })

      const { result } = renderHook(() => useCopyToClipboard("Test content"))
      const copyToClipboard = result.current

      const success = await copyToClipboard()

      expect(document.execCommand).toHaveBeenCalledWith("copy")
      expect(success).toBe(true)
    })
  })
})
