import { renderHook } from "@testing-library/react"

import { decodeHtmlEntities, replaceBrTagsWithNewlines, useCopyToClipboard } from "../utils"

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

describe("decodeHtmlEntities", () => {
  it("should decode basic HTML entities", () => {
    expect(decodeHtmlEntities("&lt;div&gt;")).toBe("<div>")
    expect(decodeHtmlEntities("&amp;")).toBe("&")
    expect(decodeHtmlEntities("&quot;hello&quot;")).toBe('"hello"')
  })

  it("should decode multiple entities in the same string", () => {
    expect(decodeHtmlEntities("&lt;p&gt;Hello &amp; goodbye&lt;/p&gt;")).toBe(
      "<p>Hello & goodbye</p>",
    )
  })

  it("should handle mixed encoded and non-encoded content", () => {
    expect(decodeHtmlEntities("Regular text &amp; <actual tag> &lt;encoded tag&gt;")).toBe(
      "Regular text & <actual tag> <encoded tag>",
    )
  })

  it("should handle numeric entities", () => {
    expect(decodeHtmlEntities("&#60;div&#62;")).toBe("<div>")
    expect(decodeHtmlEntities("&#x3C;div&#x3E;")).toBe("<div>")
  })

  it("should return empty string for empty input", () => {
    expect(decodeHtmlEntities("")).toBe("")
  })

  it("should return unchanged text when no entities present", () => {
    expect(decodeHtmlEntities("Hello world!")).toBe("Hello world!")
  })
})

describe("useCopyToClipboard", () => {
  const originalExecCommand = document.execCommand

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: jest.fn(() => Promise.resolve()),
      },
      configurable: true,
    })
    document.execCommand = jest.fn(() => true)
    // Silence console.error
    jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore console.error and document.execCommand
    jest.restoreAllMocks()
    document.execCommand = originalExecCommand
  })

  it("should handle basic text copying", async () => {
    const { result } = renderHook(() => useCopyToClipboard("Hello world"))
    const copyToClipboard = result.current

    const copyResult = await copyToClipboard()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Hello world")
    expect(copyResult.success).toBe(true)
  })

  it("should decode HTML entities and convert BR tags", async () => {
    const { result } = renderHook(() =>
      useCopyToClipboard("if (x &lt; 10) {<br>  return true;<br>}"),
    )
    const copyToClipboard = result.current

    await copyToClipboard()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("if (x < 10) {\n  return true;\n}")
  })

  it("should preserve encoded <br> tags as text", async () => {
    const { result } = renderHook(() => useCopyToClipboard("Example: &lt;br&gt; tag<br>Next line"))
    const copyToClipboard = result.current

    await copyToClipboard()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Example: <br> tag\nNext line")
  })

  it("should preserve literal \\n sequences", async () => {
    const { result } = renderHook(() =>
      useCopyToClipboard("console.log('\\n');<br>const x = '\\n';"),
    )
    const copyToClipboard = result.current

    await copyToClipboard()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "console.log('\\n');\nconst x = '\\n';",
    )
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

      const copyResult = await copyToClipboard()

      expect(document.execCommand).toHaveBeenCalledWith("copy")
      expect(copyResult.success).toBe(true)
    })

    it("should use fallback when Clipboard API is not available", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      })

      const { result } = renderHook(() => useCopyToClipboard("Test content"))
      const copyToClipboard = result.current

      const copyResult = await copyToClipboard()

      expect(document.execCommand).toHaveBeenCalledWith("copy")
      expect(copyResult.success).toBe(true)
    })

    it("should return failure when both clipboard methods fail", async () => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: jest.fn(() => Promise.reject(new Error("Clipboard failed"))),
        },
        configurable: true,
      })
      document.execCommand = jest.fn(() => false)

      const { result } = renderHook(() => useCopyToClipboard("Test content"))
      const copyToClipboard = result.current

      const copyResult = await copyToClipboard()

      expect(copyResult.success).toBe(false)
    })
  })
})
