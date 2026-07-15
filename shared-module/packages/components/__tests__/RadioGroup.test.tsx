"use client"

import { fireEvent, screen } from "@testing-library/react"
import type React from "react"

import { Radio } from "../src/components/Radio"
import { RadioGroup } from "../src/components/RadioGroup"
import { pressArrowDown, renderWithForm } from "./testUtils"

describe("RadioGroup", () => {
  test("supports single selection semantics", () => {
    const { getValues } = renderWithForm<{ r: string }>(
      (control) => (
        <RadioGroup name="r" control={control} label="Theme">
          <Radio label="Light" value="light" />
          <Radio label="Dark" value="dark" />
        </RadioGroup>
      ),
      { defaultValues: { r: "" } },
    )

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }))
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Light" })).not.toBeChecked()
    expect(getValues().r).toBe("dark")
  })

  test("supports arrow key navigation", () => {
    const { getValues } = renderWithForm<{ r: string }>(
      (control) => (
        <RadioGroup name="r" control={control} label="Direction">
          <Radio label="Left" value="left" />
          <Radio label="Right" value="right" />
        </RadioGroup>
      ),
      { defaultValues: { r: "left" } },
    )

    const left = screen.getByRole("radio", { name: "Left" })
    fireEvent.focus(left)
    pressArrowDown(left)

    expect(screen.getByRole("radio", { name: "Right" })).toBeChecked()
    expect(getValues().r).toBe("right")
  })

  test("supports required and invalid group state", () => {
    renderWithForm<{ r: string }>((control) => (
      <RadioGroup name="r" control={control} label="Plan" isRequired errorMessage="Choose one">
        <Radio label="Monthly" value="monthly" />
        <Radio label="Yearly" value="yearly" />
      </RadioGroup>
    ))

    const group = screen.getByRole("radiogroup", { name: "Plan" })
    expect(group).toHaveAttribute("aria-invalid", "true")
    expect(group).toHaveAttribute("aria-required", "true")
  })

  test("supports disabled item and disabled group behavior", () => {
    renderWithForm<{ a: string; b: string }>((control) => (
      <>
        <RadioGroup name="a" control={control} label="Disabled group" isDisabled>
          <Radio label="One" value="1" />
          <Radio label="Two" value="2" />
        </RadioGroup>
        <RadioGroup name="b" control={control} label="Mixed group">
          <Radio label="Enabled" value="a" />
          <Radio label="Disabled item" value="b" disabled />
        </RadioGroup>
      </>
    ))

    expect(screen.getByRole("radio", { name: "One" })).toBeDisabled()
    expect(screen.getByRole("radio", { name: "Two" })).toBeDisabled()
    expect(screen.getByRole("radio", { name: "Disabled item" })).toBeDisabled()
  })

  test("ignores runtime type overrides for grouped radios", () => {
    const RadioWithRuntimeTypeOverride = Radio as unknown as React.ComponentType<{
      label: string
      value: string
      type: string
    }>

    renderWithForm<{ r: string }>((control) => (
      <RadioGroup name="r" control={control} label="Runtime overrides">
        <RadioWithRuntimeTypeOverride label="Alpha" value="a" type="text" />
      </RadioGroup>
    ))

    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveAttribute("type", "radio")
  })
})
