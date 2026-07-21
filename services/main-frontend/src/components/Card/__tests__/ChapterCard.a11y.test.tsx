"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import type { CardExtraProps } from ".."
import IllustrationCard from "../IllustrationCard"
import SimpleCard from "../SimpleCard"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("Chapter grid card accessibility (issue #72)", () => {
  const baseProps: CardExtraProps = {
    variant: "simple",
    title: "Foundational elements",
    chapterNumber: 1,
    url: "/chapter-1",
    open: true,
  }

  const cases = [
    { name: "SimpleCard", Component: SimpleCard },
    { name: "IllustrationCard", Component: IllustrationCard },
  ] as const

  cases.forEach(({ name, Component }) => {
    describe(name, () => {
      it("does not render the chapter title as a heading", () => {
        render(<Component {...baseProps} />)
        expect(screen.queryByRole("heading")).not.toBeInTheDocument()
      })

      it("groups the chapter number and title inside a single link", () => {
        render(<Component {...baseProps} />)
        const links = screen.getAllByRole("link")
        expect(links).toHaveLength(1)
        // The single link's text combines the (mocked) chapter-number label and the title.
        expect(links[0]).toHaveTextContent("Foundational elements")
      })

      it("renders the title text in a plain element (span), not an h2", () => {
        const { container } = render(<Component {...baseProps} />)
        expect(container.querySelector("h2")).toBeNull()
        expect(container.querySelector("span.chapter-title")).not.toBeNull()
      })
    })
  })
})
