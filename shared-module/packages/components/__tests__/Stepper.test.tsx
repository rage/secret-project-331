"use client"

import { screen, within } from "@testing-library/react"

import { Stepper } from "../src/components/Stepper"
import { renderUi } from "./testUtils"

const STEPS = [{ label: "Choose" }, { label: "Review" }, { label: "Confirm" }]

describe("Stepper", () => {
  test("is a list with the current step marked", () => {
    renderUi(<Stepper aria-label="Progress" steps={STEPS} currentStep={1} />)
    const items = within(screen.getByRole("list", { name: "Progress" })).getAllByRole("listitem")
    expect(items).toHaveLength(3)
    expect(items[0]).not.toHaveAttribute("aria-current")
    expect(items[1]).toHaveAttribute("aria-current", "step")
    expect(items[2]).not.toHaveAttribute("aria-current")
  })

  test("announces completed steps only", () => {
    renderUi(<Stepper steps={STEPS} currentStep={2} />)
    expect(screen.getAllByText("(completed)")).toHaveLength(2)
    expect(screen.getByText("Confirm")).not.toHaveTextContent("completed")
  })

  test("per-step state overrides the derived one", () => {
    renderUi(
      <Stepper
        steps={[{ label: "A" }, { label: "B", state: "done" }, { label: "C" }]}
        currentStep={0}
      />,
    )
    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveAttribute("aria-current", "step")
    expect(items[1]).toHaveTextContent("completed")
    expect(items[2]).not.toHaveTextContent("completed")
  })
})
