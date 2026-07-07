"use client"

import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"

import AuthorBlock from "../AuthorBlock"

// Stub out InnerBlocks; it pulls in the whole ContentRenderer.
jest.mock("../../util/InnerBlocks", () => ({
  __esModule: true,
  default: () => <div data-testid="inner-blocks" />,
}))

// AuthorBlock uses the direct i18next `t`, not react-i18next's hook.
jest.mock("i18next", () => ({
  __esModule: true,
  t: (key: string) => key,
}))

describe("AuthorBlock accessibility (issue #73)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: any = {
    id: "author-block",
    name: "moocfi/author",
    isValid: true,
    attributes: { backgroundColor: "#fff" },
    clientId: "author-block",
    innerBlocks: [],
  }

  it("renders the Authors heading at level 2, not level 3", () => {
    render(<AuthorBlock {...props} />)

    const heading = screen.getByRole("heading", { name: "author" })
    expect(heading.tagName).toBe("H2")
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument()
  })
})
