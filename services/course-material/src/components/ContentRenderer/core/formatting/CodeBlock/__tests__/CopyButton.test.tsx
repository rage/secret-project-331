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

  it("should copy sanitized command text for encoded command input", async () => {
    const encodedCommand = "apt-get update &amp;&amp; apt-get install -y curl python3"
    renderCopyButton(encodedCommand)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })

    // The copy logic uses our parseHtmlToPlainText helper, so the clipboard should receive the decoded command
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "apt-get update && apt-get install -y curl python3",
    )

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(button).toHaveAttribute("aria-label", "copy-to-clipboard")
  })

  it("should copy sanitized code when <br> tags include attributes", async () => {
    const contentWithBrAttrs = 'line1<br class="break">line2<br data-test="true">line3'
    renderCopyButton(contentWithBrAttrs)
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

  it("should handle complex mixed content with HTML entities and BR tags", async () => {
    const mixedContent =
      "function test() {\n  &lt;br&gt; // literal br tag\n  <br> // actual line break\n}"
    renderCopyButton(mixedContent)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })

    // Should preserve encoded <br> as text but convert actual <br> to newline
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "function test() {\n  <br> // literal br tag\n  \n // actual line break\n}",
    )
  })

  it("should handle nested HTML entities", async () => {
    const nestedContent = "&lt;div&gt;&amp;lt;span&amp;gt;&lt;/div&gt;"
    renderCopyButton(nestedContent)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })

    // Should decode outer entities but preserve encoded entities within
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("<div>&lt;span&gt;</div>")
  })

  it("should handle code with HTML entity characters", async () => {
    const codeContent = "if (a &lt; b &amp;&amp; b &gt; c) {\n  return true;\n}"
    renderCopyButton(codeContent)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })

    // Should decode entities to actual operators
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "if (a < b && b > c) {\n  return true;\n}",
    )
  })

  it("should handle mixed line endings with BR tags", async () => {
    const mixedLineEndings = "line1<br>line2\nline3<br />line4\r\nline5"
    renderCopyButton(mixedLineEndings)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })

    // Should normalize all line endings
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("line1\nline2\nline3\nline4\nline5")
  })

  it("should preserve literal backslash-n sequences", async () => {
    const content = "console.log('\\n'); // prints: \\n"
    renderCopyButton(content)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })

    // Should preserve \n as literal characters, not convert to newlines
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("console.log('\\n'); // prints: \\n")
  })

  it("should handle mixed literal \\n and actual newlines", async () => {
    const mixedContent = "const str = '\\n';\n// actual newline\nstr === '\\n'; // true"
    renderCopyButton(mixedContent)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })

    // Should preserve \n sequences while keeping actual newlines
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "const str = '\\n';\n// actual newline\nstr === '\\n'; // true",
    )
  })

  it("should handle mixed literal \\n, <br> tags and actual newlines", async () => {
    const complexContent = "const x = '\\n';<br>const y = `\\n`;\nconst z = '\\\\n';"
    renderCopyButton(complexContent)
    const button = screen.getByRole("button")

    await act(async () => {
      fireEvent.click(button)
    })

    // Should convert <br> to newlines while preserving literal \n sequences
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "const x = '\\n';\nconst y = `\\n`;\nconst z = '\\\\n';",
    )
  })
})
