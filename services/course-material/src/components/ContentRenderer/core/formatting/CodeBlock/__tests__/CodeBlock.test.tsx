import { render, screen } from "@testing-library/react"
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

  it("should render the code block with the provided content", () => {
    renderCodeBlock(mockContent)
    expect(screen.getByText(mockContent)).toBeInTheDocument()
  })

  it("should render the copy button", () => {
    renderCodeBlock(mockContent)
    expect(screen.getByLabelText("copy-to-clipboard")).toBeInTheDocument()
  })
})
