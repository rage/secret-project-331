"use client"

import "@testing-library/jest-dom"
import { render } from "@testing-library/react"

import QuoteBlock from "../common/Quote/QuoteBlock"
import PullquoteBlock from "../formatting/PullquoteBlock"
import VerseBlock from "../formatting/VerseBlock"

jest.mock("@/components/course-material/ContentRenderer/util/InnerBlocks", () => ({
  __esModule: true,
  default: () => null,
}))

const props = (name: string, attributes: Record<string, unknown>) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ id: "b", data: { name, clientId: "b", isValid: true, innerBlocks: [], attributes } }) as any

describe("content block semantics (F-48)", () => {
  it("renders a verse as pre > code", () => {
    const { container } = render(
      <VerseBlock {...props("core/verse", { content: "line one<br>line two" })} />,
    )
    expect(container.querySelector("pre > code")).not.toBeNull()
    expect(container.querySelector("pre div")).toBeNull()
  })

  it("puts the pullquote attribution in a figcaption", () => {
    const { container } = render(
      <PullquoteBlock
        {...props("core/pullquote", { value: "Words", citation: "Dr. Lindqvist" })}
      />,
    )
    expect(container.querySelector("figure > figcaption cite")).toHaveTextContent("Dr. Lindqvist")
  })

  it("renders the quote attribution as a footer within the blockquote", () => {
    const { container } = render(
      <QuoteBlock {...props("core/quote", { value: "Words", citation: "Someone" })} />,
    )
    expect(container.querySelector("blockquote footer")).toHaveTextContent("Someone")
  })

  it("omits empty attributions", () => {
    const { container } = render(
      <PullquoteBlock {...props("core/pullquote", { value: "Words", citation: "" })} />,
    )
    expect(container.querySelector("figcaption")).toBeNull()
  })
})
