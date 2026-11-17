"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import type React from "react"

import Ingress from "../Ingress"

describe("Ingress", () => {
  it("keeps the title as h2 and renders the standfirst as a paragraph", () => {
    const props = {
      id: "i",
      data: {
        name: "moocfi/ingress",
        clientId: "i",
        isValid: true,
        innerBlocks: [],
        attributes: { title: "The Title", subtitle: "A long standfirst sentence." },
      },
    } as unknown as React.ComponentProps<typeof Ingress>
    render(<Ingress {...props} />)

    const headings = screen.getAllByRole("heading")
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent("The Title")
    expect(headings[0]?.tagName).toBe("H2")
    expect(screen.getByText("A long standfirst sentence.").tagName).toBe("P")
  })
})
