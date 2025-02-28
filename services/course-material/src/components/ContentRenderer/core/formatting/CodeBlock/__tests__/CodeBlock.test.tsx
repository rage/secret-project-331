import { render } from "@testing-library/react"
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
      selectedBlockId={null}
      editing={false}
      setEdits={() => {}}
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
})
