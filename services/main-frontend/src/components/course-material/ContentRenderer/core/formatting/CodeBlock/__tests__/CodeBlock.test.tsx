"use client"

import { fireEvent, render, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

import CodeBlock from "../index"

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

  describe("line highlighting", () => {
    it("should remove highlight markers from displayed code", async () => {
      const contentWithMarkers = "const x = 1 // highlight-line\nfoo()\nbar()"
      const { container } = renderCodeBlock(contentWithMarkers)
      await waitFor(() => {
        const codeElement = container.querySelector("code")
        expect(codeElement?.textContent).not.toContain("// highlight-line")
        expect(codeElement?.textContent).toContain("const x = 1")
        expect(codeElement?.textContent).toContain("foo()")
      })
    })

    it("should apply highlighted-line class to marked lines", async () => {
      const contentWithMarkers = "line1 // highlight-line\nline2\nline3"
      const { container } = renderCodeBlock(contentWithMarkers)
      await waitFor(
        () => {
          const highlighted = container.querySelectorAll(".highlighted-line")
          expect(highlighted.length).toBeGreaterThanOrEqual(1)
          expect(highlighted[0].textContent).toContain("line1")
        },
        { timeout: 2000 },
      )
    })

    it("should wrap lines in code-line spans when highlighting is used", async () => {
      const contentWithMarkers = "a // highlight-line\nb\nc"
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
        "const url = process.env.URI // highlight-line\nmongoose.connect(url)"
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

    it("should highlight range between highlight-start and highlight-end", async () => {
      const contentWithRange = "before\n// highlight-start\nmid1\nmid2\n// highlight-end\nafter"
      const { container } = renderCodeBlock(contentWithRange)
      await waitFor(
        () => {
          const codeElement = container.querySelector("code")
          expect(codeElement?.textContent).not.toContain("// highlight-start")
          expect(codeElement?.textContent).not.toContain("// highlight-end")
          const highlighted = container.querySelectorAll(".highlighted-line")
          expect(highlighted.length).toBeGreaterThanOrEqual(2)
        },
        { timeout: 2000 },
      )
    })

    it("correctly highlights lines in code with blank lines", async () => {
      const contentWithBlanks = "first\n\nthird // highlight-line"
      const { container } = renderCodeBlock(contentWithBlanks)
      await waitFor(
        () => {
          const lines = container.querySelectorAll(".code-line")
          expect(lines.length).toBe(3)
          expect(lines[2].classList.contains("highlighted-line")).toBe(true)
        },
        { timeout: 2000 },
      )
    })

    it("should correctly highlight lines inside multi-line block comments", async () => {
      const content = "// highlight-start\n/*\n * block comment\n */\n// highlight-end\ncode"
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
      const content = "a // highlight-line\nb"
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
      const content = "const x = 1 // highlight-line\nconst y = 2"
      const { container } = renderCodeBlock(content)
      await waitFor(
        () => {
          const highlighted = container.querySelectorAll(".highlighted-line")
          expect(highlighted.length).toBe(1)
          expect(highlighted[0].textContent).toContain("const x = 1")
        },
        { timeout: 2000 },
      )
    })
  })
})
