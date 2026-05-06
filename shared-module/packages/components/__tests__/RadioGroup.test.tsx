"use client"

import { fireEvent, screen } from "@testing-library/react"

import { Radio } from "../src/components/Radio"
import { RadioGroup } from "../src/components/RadioGroup"

import { pressArrowDown, renderUi } from "./testUtils"

describe("RadioGroup", () => {
  test("supports single selection semantics", () => {
    renderUi(
      <RadioGroup label="Theme">
        <Radio label="Light" value="light" />
        <Radio label="Dark" value="dark" />
      </RadioGroup>,
    )

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }))
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Light" })).not.toBeChecked()
  })

  test("supports arrow key navigation", () => {
    renderUi(
      <RadioGroup label="Direction" defaultValue="left">
        <Radio label="Left" value="left" />
        <Radio label="Right" value="right" />
      </RadioGroup>,
    )

    const left = screen.getByRole("radio", { name: "Left" })
    fireEvent.focus(left)
    pressArrowDown(left)

    expect(screen.getByRole("radio", { name: "Right" })).toBeChecked()
  })

  test("supports required and invalid group state", () => {
    renderUi(
      <RadioGroup label="Plan" isRequired errorMessage="Choose one">
        <Radio label="Monthly" value="monthly" />
        <Radio label="Yearly" value="yearly" />
      </RadioGroup>,
    )

    const group = screen.getByRole("radiogroup", { name: "Plan" })
    expect(group).toHaveAttribute("aria-invalid", "true")
    expect(group).toHaveAttribute("aria-required", "true")
  })

  test("supports disabled item and disabled group behavior", () => {
    renderUi(
      <>
        <RadioGroup label="Disabled group" isDisabled>
          <Radio label="One" value="1" />
          <Radio label="Two" value="2" />
        </RadioGroup>
        <RadioGroup label="Mixed group">
          <Radio label="Enabled" value="a" />
          <Radio label="Disabled item" value="b" disabled />
        </RadioGroup>
      </>,
    )

    expect(screen.getByRole("radio", { name: "One" })).toBeDisabled()
    expect(screen.getByRole("radio", { name: "Two" })).toBeDisabled()
    expect(screen.getByRole("radio", { name: "Disabled item" })).toBeDisabled()
  })

  test("honors the native disabled fieldset prop", () => {
    renderUi(
      <RadioGroup label="Native disabled" disabled>
        <Radio label="One" value="1" />
        <Radio label="Two" value="2" />
      </RadioGroup>,
    )

    expect(screen.getByRole("radio", { name: "One" })).toBeDisabled()
    expect(screen.getByRole("radio", { name: "Two" })).toBeDisabled()
  })

  test("keeps arrow navigation inside the current group when names are reused", () => {
    renderUi(
      <>
        <form>
          <RadioGroup label="Shipping" name="choice" defaultValue="express">
            <Radio label="Standard" value="standard" />
            <Radio label="Express" value="express" />
          </RadioGroup>
        </form>
        <form>
          <RadioGroup label="Billing" name="choice" defaultValue="invoice">
            <Radio label="Card" value="card" />
            <Radio label="Invoice" value="invoice" />
          </RadioGroup>
        </form>
      </>,
    )

    const express = screen.getByRole("radio", { name: "Express" })
    const standard = screen.getByRole("radio", { name: "Standard" })
    const invoice = screen.getByRole("radio", { name: "Invoice" })

    fireEvent.focus(express)
    pressArrowDown(express)

    expect(standard).toBeChecked()
    expect(invoice).toBeChecked()
    expect(document.activeElement).toBe(standard)
  })
})
