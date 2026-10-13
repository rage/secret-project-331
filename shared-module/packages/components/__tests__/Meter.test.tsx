"use client"

import { screen } from "@testing-library/react"

import { Meter, MeterInline } from "../src/components/Meter"
import { renderUi } from "./testUtils"

describe("Meter", () => {
  test("is a meter by default", () => {
    renderUi(<Meter label="Storage" value={3} maxValue={10} valueLabel="3 of 10 GB" />)
    const meter = screen.getByRole("meter", { name: "Storage" })
    expect(meter).toHaveAttribute("aria-valuetext", "3 of 10 GB")
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  test("is a progressbar for progress toward a goal", () => {
    renderUi(<Meter kind="progress" label="Points" value={12} maxValue={20} valueLabel="12 / 20" />)
    const bar = screen.getByRole("progressbar", { name: "Points" })
    expect(bar).toHaveAttribute("aria-valuenow", "12")
    expect(bar).toHaveAttribute("aria-valuetext", "12 / 20")
    expect(screen.queryByRole("meter")).not.toBeInTheDocument()
  })
})

describe("MeterInline", () => {
  test("switches role with kind", () => {
    const { rerender } = renderUi(
      <MeterInline label="Idle time" value={2} maxValue={10} valueText="2 d" />,
    )
    expect(screen.getByRole("meter", { name: "Idle time" })).toHaveAttribute(
      "aria-valuetext",
      "2 d",
    )
    rerender(
      <MeterInline kind="progress" label="Exercises" value={2} maxValue={10} valueText="2 / 10" />,
    )
    expect(screen.getByRole("progressbar", { name: "Exercises" })).toHaveAttribute(
      "aria-valuetext",
      "2 / 10",
    )
  })
})
