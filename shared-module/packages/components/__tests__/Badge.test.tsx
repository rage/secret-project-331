"use client"

import { screen } from "@testing-library/react"

import { Badge } from "../src/components/Badge"
import { renderUi } from "./testUtils"

describe("Badge", () => {
  test("renders without a description by default", () => {
    renderUi(<Badge>Active</Badge>)
    const badge = screen.getByText("Active")
    expect(badge).toBeInTheDocument()
    expect(badge).not.toHaveAttribute("aria-describedby")
  })

  test("wires a description via aria-describedby rather than title", () => {
    renderUi(<Badge description="Paused for the summer break.">Paused</Badge>)
    expect(screen.getByText("Paused")).toHaveAccessibleDescription("Paused for the summer break.")
  })

  test("renders the description as visible text", () => {
    renderUi(<Badge description="27 students received support.">27 with support</Badge>)
    expect(screen.getByText("27 students received support.")).toBeVisible()
  })
})
