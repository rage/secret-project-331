import { renderHook } from "@testing-library/react"

import {
  formatHighlightedLinesRanges,
  htmlToDisplayedText,
  replaceBrTagsWithNewlines,
  useCopyHtmlContentToClipboard,
} from "../utils"

describe("formatHighlightedLinesRanges", () => {
  it("returns empty string for empty set", () => {
    expect(formatHighlightedLinesRanges(new Set())).toBe("")
  })

  it("formats single line", () => {
    expect(formatHighlightedLinesRanges(new Set([1]))).toBe("1")
  })

  it("formats consecutive lines as range", () => {
    expect(formatHighlightedLinesRanges(new Set([2, 3, 4]))).toBe("2 to 4")
  })

  it("formats mixed single and range", () => {
    expect(formatHighlightedLinesRanges(new Set([1, 5, 6, 7, 10, 13]))).toBe("1, 5 to 7, 10, 13")
  })

  it("sorts unsorted set", () => {
    expect(formatHighlightedLinesRanges(new Set([10, 1, 5]))).toBe("1, 5, 10")
  })
})

describe("replaceBrTagsWithNewlines", () => {
  it("should return null when input is null", () => {
    expect(replaceBrTagsWithNewlines(null)).toBeNull()
  })

  it("should return undefined when input is undefined", () => {
    expect(replaceBrTagsWithNewlines(undefined)).toBeUndefined()
  })

  it("should return empty string when input is empty string", () => {
    expect(replaceBrTagsWithNewlines("")).toBe("")
  })

  it("should replace single <br> tag with newline", () => {
    expect(replaceBrTagsWithNewlines("Hello<br>World")).toBe("Hello\nWorld")
  })

  it("should replace multiple <br> tags with newlines", () => {
    expect(replaceBrTagsWithNewlines("Hello<br>Beautiful<br>World")).toBe("Hello\nBeautiful\nWorld")
  })

  it("should handle self-closing <br/> tags", () => {
    expect(replaceBrTagsWithNewlines("Hello<br/>World")).toBe("Hello\nWorld")
  })

  it("should handle <br /> tags with space", () => {
    expect(replaceBrTagsWithNewlines("Hello<br />World")).toBe("Hello\nWorld")
  })

  it("should handle <br> tags with attributes", () => {
    expect(replaceBrTagsWithNewlines('Hello<br class="test" id="br1">World')).toBe("Hello\nWorld")
  })

  it("should handle mixed br tag formats in the same string", () => {
    expect(replaceBrTagsWithNewlines("Line1<br>Line2<br />Line3<br/>Line4")).toBe(
      "Line1\nLine2\nLine3\nLine4",
    )
  })

  it("should be case insensitive", () => {
    expect(replaceBrTagsWithNewlines("Hello<BR>World<Br>Test<br>Done")).toBe(
      "Hello\nWorld\nTest\nDone",
    )
  })
})

describe("htmlToDisplayedText", () => {
  it("should decode basic HTML entities", () => {
    expect(htmlToDisplayedText("&lt;div&gt;")).toBe("<div>")
    expect(htmlToDisplayedText("&amp;")).toBe("&")
    expect(htmlToDisplayedText("&quot;hello&quot;")).toBe('"hello"')
  })

  it("should decode multiple entities in the same string", () => {
    expect(htmlToDisplayedText("&lt;p&gt;Hello &amp; goodbye&lt;/p&gt;")).toBe(
      "<p>Hello & goodbye</p>",
    )
  })

  it("should drop tags the rendered block also drops, keeping escaped ones as text", () => {
    expect(htmlToDisplayedText("Regular text &amp; <actual tag> &lt;encoded tag&gt;")).toBe(
      "Regular text &  <encoded tag>",
    )
  })

  it("should drop the <code> wrapper the CMS stores around block content", () => {
    expect(htmlToDisplayedText("<code>drop table notes;</code>")).toBe("drop table notes;")
  })

  it("should drop a <code> wrapper that covers only part of the content", () => {
    expect(htmlToDisplayedText("$ cat .env\n<code>postgres://user@host/defaultdb</code>")).toBe(
      "$ cat .env\npostgres://user@host/defaultdb",
    )
  })

  it("should handle numeric entities", () => {
    expect(htmlToDisplayedText("&#60;div&#62;")).toBe("<div>")
    expect(htmlToDisplayedText("&#x3C;div&#x3E;")).toBe("<div>")
  })

  it("should preserve newlines and blank lines", () => {
    expect(htmlToDisplayedText("a\n\nb")).toBe("a\n\nb")
  })

  it("should return empty string for empty input", () => {
    expect(htmlToDisplayedText("")).toBe("")
  })

  it("should return unchanged text when no entities present", () => {
    expect(htmlToDisplayedText("Hello world!")).toBe("Hello world!")
  })
})

describe("useCopyHtmlContentToClipboard", () => {
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
    const { result } = renderHook(() => useCopyHtmlContentToClipboard("Hello world"))
    const copyToClipboard = result.current

    const success = await copyToClipboard()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Hello world")
    expect(success).toBe(true)
  })

  it("should decode HTML entities and convert BR tags", async () => {
    const { result } = renderHook(() =>
      useCopyHtmlContentToClipboard("if (x &lt; 10) {<br>  return true;<br>}"),
    )
    const copyToClipboard = result.current

    await copyToClipboard()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("if (x < 10) {\n  return true;\n}")
  })

  it("should preserve encoded <br> tags as text", async () => {
    const { result } = renderHook(() =>
      useCopyHtmlContentToClipboard("Example: &lt;br&gt; tag<br>Next line"),
    )
    const copyToClipboard = result.current

    await copyToClipboard()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Example: <br> tag\nNext line")
  })

  it("should preserve literal \\n sequences", async () => {
    const { result } = renderHook(() =>
      useCopyHtmlContentToClipboard("console.log('\\n');<br>const x = '\\n';"),
    )
    const copyToClipboard = result.current

    await copyToClipboard()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "console.log('\\n');\nconst x = '\\n';",
    )
  })

  it("should not copy the <code> wrapper the CMS stores around block content", async () => {
    const { result } = renderHook(() =>
      useCopyHtmlContentToClipboard(
        "<code>CREATE TABLE notes (<br>    id SERIAL PRIMARY KEY,<br>    content text NOT NULL<br>);</code>",
      ),
    )
    const copyToClipboard = result.current

    await copyToClipboard()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "CREATE TABLE notes (\n    id SERIAL PRIMARY KEY,\n    content text NOT NULL\n);",
    )
  })

  it("should refuse to copy content that displays as nothing", async () => {
    const { result } = renderHook(() => useCopyHtmlContentToClipboard("<script>alert(1)</script>"))
    const copyToClipboard = result.current

    const success = await copyToClipboard()

    expect(success).toBe(false)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  describe("Fallback behavior", () => {
    it("should use fallback when Clipboard API fails", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: jest.fn(() => Promise.reject(new Error("Clipboard failed"))),
        },
        configurable: true,
      })

      const { result } = renderHook(() => useCopyHtmlContentToClipboard("Test content"))
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

      const { result } = renderHook(() => useCopyHtmlContentToClipboard("Test content"))
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

      const { result } = renderHook(() => useCopyHtmlContentToClipboard("Test content"))
      const copyToClipboard = result.current

      const success = await copyToClipboard()

      expect(success).toBe(false)
    })
  })
})
