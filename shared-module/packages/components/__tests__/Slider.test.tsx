"use client"

import { fireEvent, screen } from "@testing-library/react"

import { Slider } from "../src/components/Slider"
import { pressArrowDown, pressArrowUp, renderNumberField } from "./testUtils"

describe("Slider - accessibility wiring", () => {
  test("label is associated with the slider", () => {
    renderNumberField((control) => (
      <Slider name="f" control={control} label="Points" maxValue={10} />
    ))
    expect(screen.getByRole("slider", { name: "Points" })).toBeInTheDocument()
  })

  test("description is wired via aria-describedby", () => {
    renderNumberField((control) => (
      <Slider name="f" control={control} label="Points" maxValue={10} description="Out of 10." />
    ))
    expect(screen.getByRole("slider")).toHaveAccessibleDescription("Out of 10.")
  })

  test("errorMessage renders an alert and sets aria-invalid", () => {
    renderNumberField((control) => (
      <Slider name="f" control={control} label="Points" maxValue={10} errorMessage="Required." />
    ))
    expect(screen.getByRole("slider")).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("alert")).toHaveTextContent("Required.")
  })

  test("isDisabled disables the slider", () => {
    renderNumberField((control) => (
      <Slider name="f" control={control} label="Points" maxValue={10} isDisabled />
    ))
    expect(screen.getByRole("slider")).toBeDisabled()
  })
})

describe("Slider - value flow", () => {
  test("arrow key increments by step and commits to the form", () => {
    const { getValues } = renderNumberField(
      (control) => <Slider name="f" control={control} label="Points" maxValue={10} step={1} />,
      3,
    )
    pressArrowUp(screen.getByRole("slider"))
    expect(getValues().f).toBe(4)
  })

  test("arrow key decrements by step and commits to the form", () => {
    const { getValues } = renderNumberField(
      (control) => <Slider name="f" control={control} label="Points" maxValue={10} step={1} />,
      3,
    )
    pressArrowDown(screen.getByRole("slider"))
    expect(getValues().f).toBe(2)
  })

  test("Home/End jump to min/max", () => {
    const { getValues } = renderNumberField(
      (control) => <Slider name="f" control={control} label="Points" maxValue={10} step={1} />,
      3,
    )
    const slider = screen.getByRole("slider")
    fireEvent.keyDown(slider, { key: "End" })
    expect(getValues().f).toBe(10)
    fireEvent.keyDown(slider, { key: "Home" })
    expect(getValues().f).toBe(0)
  })

  test("clamps to maxValue", () => {
    const { getValues } = renderNumberField(
      (control) => <Slider name="f" control={control} label="Points" maxValue={5} step={1} />,
      5,
    )
    pressArrowUp(screen.getByRole("slider"))
    expect(getValues().f).toBe(5)
  })

  test("clamps to minValue", () => {
    const { getValues } = renderNumberField(
      (control) => (
        <Slider name="f" control={control} label="Points" minValue={0} maxValue={5} step={1} />
      ),
      0,
    )
    pressArrowDown(screen.getByRole("slider"))
    expect(getValues().f).toBe(0)
  })

  test("an off-step initial value is preserved in the form until the user interacts", () => {
    // A linked NumberField bound to the same RHF field can commit a value finer than `step`
    // (e.g. 7.35 with step=0.1). The slider renders it at the nearest step position, but must
    // not write the snapped value back into the form on mount/re-render.
    const { getValues } = renderNumberField(
      (control) => <Slider name="f" control={control} label="Points" maxValue={10} step={0.1} />,
      7.35,
    )
    expect(getValues().f).toBe(7.35)
  })
})

describe("Slider - value label", () => {
  test("shows the formatted current value by default", () => {
    renderNumberField(
      (control) => <Slider name="f" control={control} label="Points" maxValue={10} />,
      4,
    )
    expect(screen.getByText("4")).toBeInTheDocument()
  })

  test("showValueLabel false hides the value output", () => {
    renderNumberField(
      (control) => (
        <Slider name="f" control={control} label="Points" maxValue={10} showValueLabel={false} />
      ),
      4,
    )
    expect(screen.queryByText("4")).not.toBeInTheDocument()
  })
})
