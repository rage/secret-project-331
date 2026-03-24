"use client"

import { fireEvent, screen } from "@testing-library/react"

import { ComboBox } from "../src/components/ComboBox"

import { pressArrowDown, pressEnter, pressTab, renderUi } from "./testUtils"

type Item = {
  id: string
  label: string
  disabled?: boolean
}

const items: Item[] = [
  { id: "alpha", label: "Alpha" },
  { id: "beta", label: "Beta" },
  { id: "gamma", label: "Gamma" },
]

describe("ComboBox", () => {
  test("opens and closes from the toggle button", () => {
    renderUi(
      <ComboBox label="Framework" items={items}>
        {(item) => item.label}
      </ComboBox>,
    )

    const toggle = screen.getByLabelText("Toggle options")
    fireEvent.click(toggle)
    expect(screen.getByRole("listbox")).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  test("opens from the keyboard and filters results", () => {
    renderUi(
      <ComboBox label="Framework" items={items}>
        {(item) => item.label}
      </ComboBox>,
    )

    const input = screen.getByRole("combobox", { name: "Framework" })
    pressArrowDown(input)
    expect(screen.getByRole("listbox")).toBeInTheDocument()

    fireEvent.change(input, { target: { value: "be" } })
    expect(screen.getByRole("option", { name: "Beta" })).toBeInTheDocument()
  })

  test("selects an option and fires onSelectionChange", () => {
    const onSelectionChange = jest.fn()

    renderUi(
      <ComboBox label="Framework" items={items} onSelectionChange={onSelectionChange}>
        {(item) => item.label}
      </ComboBox>,
    )

    fireEvent.click(screen.getByLabelText("Toggle options"))
    fireEvent.click(screen.getByRole("option", { name: "Gamma" }))

    expect(onSelectionChange).toHaveBeenCalledWith("gamma")
    expect(screen.getByRole("combobox", { name: "Framework" })).toHaveValue("Gamma")
  })

  test("supports controlled selectedKey updates", () => {
    const { rerender } = renderUi(
      <ComboBox label="Framework" items={items} selectedKey="alpha">
        {(item) => item.label}
      </ComboBox>,
    )

    expect(screen.getByRole("combobox", { name: "Framework" })).toHaveValue("Alpha")

    rerender(
      <ComboBox label="Framework" items={items} selectedKey="beta">
        {(item) => item.label}
      </ComboBox>,
    )

    expect(screen.getByRole("combobox", { name: "Framework" })).toHaveValue("Beta")
  })

  test("returns focus to the input after selection and closes on tab", () => {
    renderUi(
      <ComboBox label="Framework" items={items}>
        {(item) => item.label}
      </ComboBox>,
    )

    const input = screen.getByRole("combobox", { name: "Framework" })
    fireEvent.click(screen.getByLabelText("Toggle options"))
    fireEvent.click(screen.getByRole("option", { name: "Alpha" }))

    expect(document.activeElement).toBe(input)

    fireEvent.click(screen.getByLabelText("Toggle options"))
    pressTab(input)
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  test("skips disabled options during keyboard selection", () => {
    const onSelectionChange = jest.fn()

    renderUi(
      <ComboBox
        label="Framework"
        items={[
          { id: "alpha", label: "Alpha" },
          { id: "beta", label: "Beta", disabled: true },
          { id: "gamma", label: "Gamma" },
        ]}
        onSelectionChange={onSelectionChange}
      >
        {(item) => item.label}
      </ComboBox>,
    )

    const input = screen.getByRole("combobox", { name: "Framework" })
    fireEvent.click(screen.getByLabelText("Toggle options"))
    pressArrowDown(input)
    pressEnter(input)

    expect(onSelectionChange).toHaveBeenCalledWith("gamma")
    expect(input).toHaveValue("Gamma")
  })

  test("restores the committed value on blur when custom values are disallowed", () => {
    renderUi(
      <ComboBox label="Framework" items={items} defaultSelectedKey="alpha">
        {(item) => item.label}
      </ComboBox>,
    )

    const input = screen.getByRole("combobox", { name: "Framework" })
    fireEvent.change(input, { target: { value: "Zeta" } })
    pressTab(input)
    fireEvent.blur(input)

    expect(input).toHaveValue("Alpha")
  })

  test("wires description and invalid state", () => {
    renderUi(
      <ComboBox label="Framework" items={items} description="Pick one" errorMessage="Required">
        {(item) => item.label}
      </ComboBox>,
    )

    const input = screen.getByRole("combobox", { name: "Framework" })
    expect(input).toHaveAttribute("aria-describedby")
    expect(input).toHaveAttribute("aria-invalid", "true")
  })
})
