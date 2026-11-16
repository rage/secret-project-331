"use client"

import { fireEvent, screen } from "@testing-library/react"

import { PercentageCalculatorDialog } from "../src/components/PercentageCalculatorDialog"
import { renderUi } from "./testUtils"

describe("PercentageCalculatorDialog", () => {
  test("rounds up and passes only the count", () => {
    const onUse = jest.fn()
    renderUi(
      <PercentageCalculatorDialog
        open
        onClose={() => {}}
        title="Exercises attempted"
        total={42}
        formatQuantity={(count) => `${count} exercises`}
        unitPlural="exercises"
        defaultPercentage={70}
        onUse={onUse}
      />,
    )

    expect(
      screen.getByText(
        "70 % of 42 exercises = 0.7 × 42 = 29.4. Rounded up, that is 30 exercises. We round up so the requirement is never lower than the percentage.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Only the number 30 is saved. If you add exercises later, the requirement stays 30.",
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Use 30" }))
    expect(onUse).toHaveBeenCalledWith(30)
  })
})
