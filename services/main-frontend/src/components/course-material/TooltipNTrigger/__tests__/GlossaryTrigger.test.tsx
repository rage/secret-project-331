"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import TooltipNTrigger from ".."

describe("glossary trigger", () => {
  it("describes the button with a hint that is not part of the text flow", () => {
    const { container } = render(
      <p>
        a <TooltipNTrigger tooltipContent="A story">saga</TooltipNTrigger> here
      </p>,
    )

    const button = screen.getByRole("button", { name: "saga" })
    const hint = container.querySelector(`[id="${button.getAttribute("aria-describedby")}"]`)
    expect(hint).toHaveAttribute("hidden")
    expect(hint).toHaveTextContent("press-to-view-definition")
  })
})
