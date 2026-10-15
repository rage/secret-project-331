"use client"

import { fireEvent, render, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

import { parseHighlightedCode } from "../highlightParser"
import CodeBlock from "../index"
import { replaceBrTagsWithNewlines } from "../utils"

// Helper function for rendering CodeBlock with default content
const renderCodeBlock = (content = 'console.log("Hello, World!")') =>
  render(
    <CodeBlock
      data={{
        attributes: { content },
        name: "core/code",
        isValid: true,
        clientId: "test-id",
        innerBlocks: [],
      }}
      id="test-id"
      isExam={false}
    />,
  )

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard")

/** Replaces navigator.clipboard with a mock and returns its writeText spy. */
const mockClipboard = () => {
  const writeText = jest.fn(() => Promise.resolve())
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
  // useCopyToClipboard logs every copied string, which would dump test fixtures into CI output.
  jest.spyOn(console, "info").mockImplementation()
  return writeText
}

afterEach(() => {
  jest.restoreAllMocks()
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard)
  } else {
    Reflect.deleteProperty(navigator, "clipboard")
  }
})

describe("CodeBlock", () => {
  const mockContent = 'console.log("Hello, World!")'

  it("should render the code block with the provided content and syntax highlighting", () => {
    const { container } = renderCodeBlock(mockContent)
    const codeElement = container.querySelector("code")
    expect(codeElement).toBeInTheDocument()

    // Check that the combined text contains our expected content
    expect(codeElement?.textContent).toContain('console.log("Hello, World!")')

    // Verify syntax highlighting was applied
    expect(codeElement?.querySelector(".hljs-built_in")).toBeInTheDocument()
    expect(codeElement?.querySelector(".hljs-string")).toBeInTheDocument()
  })

  it("should render the copy button", () => {
    const { container } = renderCodeBlock(mockContent)
    const copyButton = container.querySelector('button[aria-label="copy-to-clipboard"]')
    expect(copyButton).toBeInTheDocument()
  })

  it("should display line breaks normally when content includes <br> tags", () => {
    const contentWithBr = "line1<br>line2<br>line3"
    const { container } = renderCodeBlock(contentWithBr)
    const codeElement = container.querySelector("code")
    expect(codeElement).toBeInTheDocument()
    expect(codeElement?.textContent).toBe("line1\nline2\nline3")
  })

  it("should correctly render encoded HTML input as the user sees it", () => {
    const encodedContent = "&lt;html>\n  &lt;p>hello&lt;br>world!&lt;/p>\n&lt;/html>"
    const { container } = renderCodeBlock(encodedContent)
    const codeElement = container.querySelector("code")
    expect(codeElement).toBeInTheDocument()
    // The user sees the decoded HTML with a literal <br> tag:
    expect(codeElement?.textContent).toBe("<html>\n  <p>hello<br>world!</p>\n</html>")
  })

  it("should correctly render encoded command input", () => {
    const encodedCommand = "apt-get update &amp;&amp; apt-get install -y curl python3"
    const { container } = renderCodeBlock(encodedCommand)
    const codeElement = container.querySelector("code")
    expect(codeElement).toBeInTheDocument()
    // The code block should decode the encoded ampersands
    expect(codeElement?.textContent).toBe("apt-get update && apt-get install -y curl python3")
  })

  describe("content the CMS wrapped in <code>", () => {
    // Real core/code content from the CMS: the <code> wrapper sits inside the block's content
    // attribute, renders as nothing, and must not reach the clipboard.
    const CMS_WRAPPED_CODE_TEXT = `[
  {
    "_id": "600c0e410d10256466898a6c",
    "content": "HTML is easy"
    "date": 2026-01-23T11:53:37.292+00:00,
    "important": false
    "__v": 0
  },
  {
    "_id": "600c0edde86c7264ace9bb78",
    "content": "CSS is hard"
    "date": 2026-01-23T11:56:13.912+00:00,
    "important": true
    "__v": 0
  },
]`
    const CMS_WRAPPED_CODE_CONTENT = `<code>${CMS_WRAPPED_CODE_TEXT}</code>`
    const PARTIALLY_WRAPPED_CONTENT =
      "$ cat .env\n<code>postgres://user@host:10789/defaultdb</code>"
    const PARTIALLY_WRAPPED_TEXT = "$ cat .env\npostgres://user@host:10789/defaultdb"

    it("renders the code without the wrapper", () => {
      const { container } = renderCodeBlock(CMS_WRAPPED_CODE_CONTENT)
      const codeElement = container.querySelector("code")
      expect(codeElement).toBeInTheDocument()
      expect(codeElement?.textContent).toBe(CMS_WRAPPED_CODE_TEXT)
    })

    it("copies the code without the wrapper", async () => {
      const writeText = mockClipboard()
      const { container } = renderCodeBlock(CMS_WRAPPED_CODE_CONTENT)
      const copyButton = container.querySelector('button[aria-label="copy-to-clipboard"]')
      expect(copyButton).toBeInTheDocument()
      fireEvent.click(copyButton!)
      await waitFor(() => {
        expect(writeText).toHaveBeenCalled()
      })
      expect(writeText).toHaveBeenCalledWith(CMS_WRAPPED_CODE_TEXT)
    })

    it("renders and copies the same text when only part of the content is wrapped", async () => {
      const writeText = mockClipboard()
      const { container } = renderCodeBlock(PARTIALLY_WRAPPED_CONTENT)
      const codeElement = container.querySelector("code")
      expect(codeElement?.textContent).toBe(PARTIALLY_WRAPPED_TEXT)
      const copyButton = container.querySelector('button[aria-label="copy-to-clipboard"]')
      fireEvent.click(copyButton!)
      await waitFor(() => {
        expect(writeText).toHaveBeenCalled()
      })
      expect(writeText).toHaveBeenCalledWith(PARTIALLY_WRAPPED_TEXT)
    })
  })

  describe("line highlighting", () => {
    it("should remove highlight markers from displayed code", async () => {
      const contentWithMarkers = "const x = 1 // HIGHLIGHT LINE\nfoo()\nbar()"
      const { container } = renderCodeBlock(contentWithMarkers)
      await waitFor(() => {
        const codeElement = container.querySelector("code")
        expect(codeElement?.textContent).not.toContain("// HIGHLIGHT LINE")
        expect(codeElement?.textContent).toContain("const x = 1")
        expect(codeElement?.textContent).toContain("foo()")
      })
    })

    it("should apply highlighted-line class to marked lines", async () => {
      const contentWithMarkers = "line1 // HIGHLIGHT LINE\nline2\nline3"
      const { container } = renderCodeBlock(contentWithMarkers)
      await waitFor(
        () => {
          const highlighted = container.querySelectorAll(".highlighted-line")
          expect(highlighted.length).toBeGreaterThanOrEqual(1)
          expect(highlighted[0]!.textContent).toContain("line1")
        },
        { timeout: 2000 },
      )
    })

    it("should wrap lines in code-line spans when highlighting is used", async () => {
      const contentWithMarkers = "a // HIGHLIGHT LINE\nb\nc"
      const { container } = renderCodeBlock(contentWithMarkers)
      await waitFor(
        () => {
          const codeLines = container.querySelectorAll(".code-line")
          expect(codeLines.length).toBeGreaterThanOrEqual(2)
        },
        { timeout: 2000 },
      )
    })

    it("should copy clean code without markers when copy button is used", async () => {
      const writeText = jest.fn(() => Promise.resolve())
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      })
      const consoleSpy = jest.spyOn(console, "info").mockImplementation()
      const contentWithMarkers =
        "const url = process.env.URI // HIGHLIGHT LINE\nmongoose.connect(url)"
      const { container } = renderCodeBlock(contentWithMarkers)
      const copyButton = container.querySelector('button[aria-label="copy-to-clipboard"]')
      expect(copyButton).toBeInTheDocument()
      fireEvent.click(copyButton!)
      await waitFor(() => {
        expect(writeText).toHaveBeenCalled()
      })
      expect(writeText).toHaveBeenCalledWith("const url = process.env.URI\nmongoose.connect(url)")
      consoleSpy.mockRestore()
    })

    it("copied text matches cleanCode when content has <br> and highlight markers (no extra blank lines from markers)", async () => {
      const writeText = jest.fn(() => Promise.resolve())
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      })
      const contentWithBrAndMarkers =
        "const url = process.env.MONGODB_URI // HIGHLIGHT LINE<br><br>mongoose.connect(url)<br>// BEGIN HIGHLIGHT<br>.then(result => {<br>  console.log('connected to MongoDB')<br>})<br>.catch(error => {<br>  console.log('error connecting to MongoDB:', error.message)<br>})<br>// END HIGHLIGHT<br><br>module.exports = mongoose.model('Note', noteSchema) // HIGHLIGHT LINE"
      const { container } = renderCodeBlock(contentWithBrAndMarkers)
      await waitFor(() => {
        const codeElement = container.querySelector("code")
        expect(codeElement?.textContent).not.toContain("// HIGHLIGHT")
      })
      const copyButton = container.querySelector('button[aria-label="copy-to-clipboard"]')
      fireEvent.click(copyButton!)
      await waitFor(() => {
        expect(writeText).toHaveBeenCalled()
      })
      const copied = (writeText.mock.calls[0] as unknown as [string] | undefined)?.[0]
      expect(copied).toBeDefined()
      const processed = replaceBrTagsWithNewlines(contentWithBrAndMarkers)
      const { cleanCode: expected } = parseHighlightedCode(processed ?? "")
      expect(String(copied).replaceAll("\r\n", "\n")).toBe(expected)
    })

    it("copies code with blank lines preserved when marker-only lines are removed", async () => {
      const writeText = jest.fn(() => Promise.resolve())
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      })
      const content = "a\n// BEGIN HIGHLIGHT\n\nb\n// END HIGHLIGHT\n\nc"
      const { container } = renderCodeBlock(content)
      const copyButton = container.querySelector('button[aria-label="copy-to-clipboard"]')
      expect(copyButton).toBeInTheDocument()
      fireEvent.click(copyButton!)
      await waitFor(() => {
        expect(writeText).toHaveBeenCalled()
      })
      expect(writeText).toHaveBeenCalledWith("a\n\nb\n\nc")
    })

    it("should highlight range between BEGIN HIGHLIGHT and END HIGHLIGHT", async () => {
      const contentWithRange = "before\n// BEGIN HIGHLIGHT\nmid1\nmid2\n// END HIGHLIGHT\nafter"
      const { container } = renderCodeBlock(contentWithRange)
      await waitFor(
        () => {
          const codeElement = container.querySelector("code")
          expect(codeElement?.textContent).not.toContain("// BEGIN HIGHLIGHT")
          expect(codeElement?.textContent).not.toContain("// END HIGHLIGHT")
          const highlighted = container.querySelectorAll(".highlighted-line")
          expect(highlighted.length).toBeGreaterThanOrEqual(2)
        },
        { timeout: 2000 },
      )
    })

    it("preserves blank lines around marker-only lines in rendered output", async () => {
      const content = "top\n\n// BEGIN HIGHLIGHT\n\ninside\n\n// END HIGHLIGHT\n\nbottom"
      const { container } = renderCodeBlock(content)
      await waitFor(
        () => {
          const lines = container.querySelectorAll(".code-line")
          expect(lines.length).toBe(7)
          expect(lines[0]!.textContent).toBe("top")
          expect(lines[1]!.textContent).toBe("")
          expect(lines[2]!.textContent).toBe("")
          expect(lines[3]!.textContent).toBe("inside")
          expect(lines[4]!.textContent).toBe("")
          expect(lines[5]!.textContent).toBe("")
          expect(lines[6]!.textContent).toBe("bottom")
          expect(lines[1]!.querySelector("br")).not.toBeNull()
          expect(lines[2]!.querySelector("br")).not.toBeNull()
          expect(lines[4]!.querySelector("br")).not.toBeNull()
          expect(lines[5]!.querySelector("br")).not.toBeNull()
          expect(lines[2]!.classList.contains("highlighted-line")).toBe(true)
          expect(lines[3]!.classList.contains("highlighted-line")).toBe(true)
          expect(lines[4]!.classList.contains("highlighted-line")).toBe(true)
          expect(lines[5]!.classList.contains("highlighted-line")).toBe(false)
        },
        { timeout: 2000 },
      )
    })

    it("preserves leading and trailing empty lines when markers are present", async () => {
      const content = "<br>// BEGIN HIGHLIGHT<br>inside<br>// END HIGHLIGHT<br>"
      const { container } = renderCodeBlock(content)
      await waitFor(
        () => {
          const lines = container.querySelectorAll(".code-line")
          expect(lines.length).toBe(3)
          expect(lines[0]!.textContent).toBe("")
          expect(lines[1]!.textContent).toBe("inside")
          expect(lines[2]!.textContent).toBe("")
          expect(lines[1]!.classList.contains("highlighted-line")).toBe(true)
        },
        { timeout: 2000 },
      )
    })

    it("should recognize highlight markers when content has <br> tags", async () => {
      const contentWithBrAndMarkers =
        "const x = 1 // HIGHLIGHT LINE<br/>const y = 2<br/>// BEGIN HIGHLIGHT<br/>const z = 3<br/>// END HIGHLIGHT"
      const { container } = renderCodeBlock(contentWithBrAndMarkers)
      await waitFor(
        () => {
          const codeElement = container.querySelector("code")
          expect(codeElement?.textContent).not.toContain("// HIGHLIGHT LINE")
          expect(codeElement?.textContent).not.toContain("// BEGIN HIGHLIGHT")
          expect(codeElement?.textContent).not.toContain("// END HIGHLIGHT")
          const highlighted = container.querySelectorAll(".highlighted-line")
          expect(highlighted.length).toBeGreaterThanOrEqual(2)
          expect(highlighted[0]!.textContent).toContain("const x = 1")
        },
        { timeout: 2000 },
      )
    })

    it("correctly highlights lines in code with blank lines", async () => {
      const contentWithBlanks = "first\n\nthird // HIGHLIGHT LINE"
      const { container } = renderCodeBlock(contentWithBlanks)
      await waitFor(
        () => {
          const lines = container.querySelectorAll(".code-line")
          expect(lines.length).toBe(3)
          expect(lines[2]!.classList.contains("highlighted-line")).toBe(true)
        },
        { timeout: 2000 },
      )
    })

    it("should correctly highlight lines inside multi-line block comments", async () => {
      const content = "// BEGIN HIGHLIGHT\n/*\n * block comment\n */\n// END HIGHLIGHT\ncode"
      const { container } = renderCodeBlock(content)
      await waitFor(
        () => {
          const highlighted = container.querySelectorAll(".highlighted-line")
          expect(highlighted.length).toBeGreaterThanOrEqual(3)
        },
        { timeout: 2000 },
      )
    })

    it("should not double-wrap lines on re-render", async () => {
      const content = "a // HIGHLIGHT LINE\nb"
      const data = {
        attributes: { content },
        name: "core/code" as const,
        isValid: true,
        clientId: "test-id",
        innerBlocks: [],
      }
      const { container, rerender } = render(<CodeBlock data={data} id="test-id" isExam={false} />)
      await waitFor(() => {
        expect(container.querySelectorAll(".code-line").length).toBe(2)
      })
      rerender(<CodeBlock data={data} id="test-id" isExam={false} />)
      await waitFor(() => {
        expect(container.querySelectorAll(".code-line").length).toBe(2)
      })
    })

    it("should highlight lines when language is auto-detected", async () => {
      const content = "const x = 1 // HIGHLIGHT LINE\nconst y = 2"
      const { container } = renderCodeBlock(content)
      await waitFor(
        () => {
          const highlighted = container.querySelectorAll(".highlighted-line")
          expect(highlighted.length).toBe(1)
          expect(highlighted[0]!.textContent).toContain("const x = 1")
        },
        { timeout: 2000 },
      )
    })

    it("should strip # HIGHLIGHT LINE and highlight regardless of language", async () => {
      const content = "x = 1  # HIGHLIGHT LINE\ny = 2"
      const { container } = renderCodeBlock(content)
      await waitFor(
        () => {
          const codeEl = container.querySelector("code")
          expect(codeEl?.textContent).not.toContain("# HIGHLIGHT LINE")
          const highlighted = container.querySelectorAll(".highlighted-line")
          expect(highlighted.length).toBe(1)
          expect(highlighted[0]!.textContent?.trim()).toBe("x = 1")
        },
        { timeout: 2000 },
      )
    })

    it("announces highlighted lines to screen readers when highlights are present", () => {
      const content = "line1 // HIGHLIGHT LINE\nline2\nline3 // HIGHLIGHT LINE"
      const { container } = renderCodeBlock(content)
      const preParent = container.querySelector("pre")?.parentElement
      const srOnlyEl =
        preParent?.querySelector(":scope > span") ?? preParent?.querySelector(":scope > div")
      expect(srOnlyEl).toBeInTheDocument()
      expect(srOnlyEl?.textContent?.length).toBeGreaterThan(0)
    })
  })
})
