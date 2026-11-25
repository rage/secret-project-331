import { render, screen } from "@testing-library/react"
import { vi } from "vitest"

import ParsedTextField from "../ParsedTextField"

vi.mock("../../../../../ParsedText", () => ({
  __esModule: true,
  default: ({ text }: { text: string | null }) => <span>{text}</span>,
}))

describe("ParsedTextField", () => {
  it("names the formatting help link", () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        public observe() {}
        public unobserve() {}
        public disconnect() {}
      },
    )
    render(<ParsedTextField label="Message" value="" onChange={() => {}} />)
    expect(screen.getByRole("link", { name: "formatting-help-link" })).toBeInTheDocument()
  })
})
