"use client"

import { fireEvent, render, screen } from "@testing-library/react"

import { ComboBox } from "../src/components/ComboBox"
import { FormHarness, pressArrowDown, pressEnter, pressTab, renderWithForm } from "./testUtils"

interface Item {
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
    renderWithForm<{ c: string | number | null }>(
      (control) => (
        <ComboBox<Item, { c: string | number | null }>
          name="c"
          control={control}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.label}
          label="Framework"
          items={items}
        >
          {(item) => item.label}
        </ComboBox>
      ),
      { defaultValues: { c: null } },
    )

    const toggle = screen.getByLabelText("Toggle options")
    fireEvent.click(toggle)
    expect(screen.getByRole("listbox")).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  test("opens from the keyboard and filters results", () => {
    renderWithForm<{ c: string | number | null }>((control) => (
      <ComboBox<Item, { c: string | number | null }>
        name="c"
        control={control}
        getItemKey={(item) => item.id}
        getItemTextValue={(item) => item.label}
        label="Framework"
        items={items}
      >
        {(item) => item.label}
      </ComboBox>
    ))

    const input = screen.getByRole("combobox", { name: "Framework" })
    pressArrowDown(input)
    expect(screen.getByRole("listbox")).toBeInTheDocument()

    fireEvent.change(input, { target: { value: "be" } })
    expect(screen.getByRole("option", { name: "Beta" })).toBeInTheDocument()
  })

  test("selects an option and updates RHF value", () => {
    const { getValues } = renderWithForm<{ c: string | number | null }>(
      (control) => (
        <ComboBox<Item, { c: string | number | null }>
          name="c"
          control={control}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.label}
          label="Framework"
          items={items}
        >
          {(item) => item.label}
        </ComboBox>
      ),
      { defaultValues: { c: null } },
    )

    fireEvent.click(screen.getByLabelText("Toggle options"))
    fireEvent.click(screen.getByRole("option", { name: "Gamma" }))

    expect(getValues().c).toBe("gamma")
    expect(screen.getByRole("combobox", { name: "Framework" })).toHaveValue("Gamma")
  })

  test("supports form-driven value updates", () => {
    const { rerender } = render(
      <FormHarness<{ c: string | number | null }> key="a" defaultValues={{ c: "alpha" }}>
        {(control) => (
          <ComboBox<Item, { c: string | number | null }>
            name="c"
            control={control}
            getItemKey={(item) => item.id}
            getItemTextValue={(item) => item.label}
            label="Framework"
            items={items}
          >
            {(item) => item.label}
          </ComboBox>
        )}
      </FormHarness>,
    )

    expect(screen.getByRole("combobox", { name: "Framework" })).toHaveValue("Alpha")

    rerender(
      <FormHarness<{ c: string | number | null }> key="b" defaultValues={{ c: "beta" }}>
        {(control) => (
          <ComboBox<Item, { c: string | number | null }>
            name="c"
            control={control}
            getItemKey={(item) => item.id}
            getItemTextValue={(item) => item.label}
            label="Framework"
            items={items}
          >
            {(item) => item.label}
          </ComboBox>
        )}
      </FormHarness>,
    )

    expect(screen.getByRole("combobox", { name: "Framework" })).toHaveValue("Beta")
  })

  test("returns focus to the input after selection and closes on tab", () => {
    renderWithForm<{ c: string | number | null }>((control) => (
      <ComboBox<Item, { c: string | number | null }>
        name="c"
        control={control}
        getItemKey={(item) => item.id}
        getItemTextValue={(item) => item.label}
        label="Framework"
        items={items}
      >
        {(item) => item.label}
      </ComboBox>
    ))

    const input = screen.getByRole("combobox", { name: "Framework" })
    fireEvent.click(screen.getByLabelText("Toggle options"))
    fireEvent.click(screen.getByRole("option", { name: "Alpha" }))

    expect(document.activeElement).toBe(input)

    fireEvent.click(screen.getByLabelText("Toggle options"))
    pressTab(input)
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  test("skips disabled options during keyboard selection", () => {
    const { getValues } = renderWithForm<{ c: string | number | null }>(
      (control) => (
        <ComboBox<Item, { c: string | number | null }>
          name="c"
          control={control}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.label}
          label="Framework"
          items={[
            { id: "alpha", label: "Alpha" },
            { id: "beta", label: "Beta", disabled: true },
            { id: "gamma", label: "Gamma" },
          ]}
        >
          {(item) => item.label}
        </ComboBox>
      ),
      { defaultValues: { c: null } },
    )

    const input = screen.getByRole("combobox", { name: "Framework" })
    fireEvent.click(screen.getByLabelText("Toggle options"))
    pressArrowDown(input)
    pressEnter(input)

    expect(getValues().c).toBe("gamma")
    expect(input).toHaveValue("Gamma")
  })

  test("restores the committed value on blur when custom values are disallowed", () => {
    renderWithForm<{ c: string | number | null }>(
      (control) => (
        <ComboBox<Item, { c: string | number | null }>
          name="c"
          control={control}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.label}
          label="Framework"
          items={items}
        >
          {(item) => item.label}
        </ComboBox>
      ),
      { defaultValues: { c: "alpha" } },
    )

    const input = screen.getByRole("combobox", { name: "Framework" })
    fireEvent.change(input, { target: { value: "Zeta" } })
    pressTab(input)
    fireEvent.blur(input)

    expect(input).toHaveValue("Alpha")
  })

  test("wires description and invalid state", () => {
    renderWithForm<{ c: string | number | null }>((control) => (
      <ComboBox<Item, { c: string | number | null }>
        name="c"
        control={control}
        description="Pick one"
        errorMessage="Required"
        getItemKey={(item) => item.id}
        getItemTextValue={(item) => item.label}
        label="Framework"
        items={items}
      >
        {(item) => item.label}
      </ComboBox>
    ))

    const input = screen.getByRole("combobox", { name: "Framework" })
    expect(input).toHaveAttribute("aria-describedby")
    expect(input).toHaveAttribute("aria-invalid", "true")
  })
})
