import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import CodeBlock from "../index"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: () => new Promise(() => {}),
    },
  }),
  Translation: ({ children }: { children: (t: (key: string) => string) => React.ReactNode }) =>
    children((key: string) => key),
}))

jest.mock("next/dynamic", () => () => {
  const DynamicComponent = ({ content }: { content: string }) => <div>{content}</div>
  return DynamicComponent
})

describe("CodeBlock", () => {
  const mockContent = 'console.log("Hello, World!")'
  const defaultProps = {
    data: {
      attributes: { content: mockContent },
      name: "core/code",
      isValid: true,
      clientId: "test-id",
      innerBlocks: [],
    },
    id: "test-id",
    selectedBlockId: null,
    editing: false,
    setEdits: () => {},
    isExam: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the code block with the provided content", () => {
    render(<CodeBlock {...defaultProps} />)
    expect(screen.getByText(mockContent)).toBeInTheDocument()
  })

  it("renders the copy button", () => {
    render(<CodeBlock {...defaultProps} />)
    expect(screen.getByLabelText("copy-to-clipboard")).toBeInTheDocument()
  })
})
