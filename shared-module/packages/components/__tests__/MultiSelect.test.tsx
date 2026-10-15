"use client"

import { fireEvent, screen } from "@testing-library/react"

import { MultiSelect } from "../src/components/MultiSelect"
import { renderWithForm } from "./testUtils"

interface State {
  id: string
  name: string
}

const states: State[] = [
  { id: "blocked", name: "Blocked" },
  { id: "registered", name: "Registered" },
  { id: "submitting", name: "Submitting" },
]

interface StateFilterForm {
  states: string[]
}

function renderMultiSelect(picked: string[] = []) {
  return renderWithForm<StateFilterForm>(
    (control) => (
      <MultiSelect
        name="states"
        control={control}
        getItemKey={(state) => state.id}
        getItemTextValue={(state) => state.name}
        items={states}
        label="State"
        placeholder="Add a state"
      />
    ),
    { defaultValues: { states: picked } },
  )
}

function openList() {
  fireEvent.click(screen.getByRole("button", { name: /State/ }))
}

describe("MultiSelect", () => {
  test("names the control by its label and says how many values are picked", () => {
    renderMultiSelect(["blocked", "registered"])

    expect(screen.getByRole("button", { name: "State 2 selected" })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
  })

  test("shows the placeholder while nothing is picked", () => {
    renderMultiSelect()

    expect(screen.getByText("Add a state")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "State Nothing selected" })).toBeInTheDocument()
  })

  test("adds a picked value to the field without closing the list", () => {
    const { getValues } = renderMultiSelect()

    openList()
    fireEvent.click(screen.getByRole("option", { name: "Registered" }))

    expect(getValues().states).toEqual(["registered"])
    expect(screen.getByRole("listbox")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("option", { name: "Blocked" }))

    expect(getValues().states).toEqual(["registered", "blocked"])
  })

  test("offers a multi-selectable list that marks what is already picked", () => {
    renderMultiSelect(["blocked"])

    openList()

    expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true")
    expect(screen.getByRole("option", { name: "Blocked" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("option", { name: "Registered" })).toHaveAttribute(
      "aria-selected",
      "false",
    )
  })

  test("drops a value from its own tag", () => {
    const { getValues } = renderMultiSelect(["blocked", "registered"])

    fireEvent.click(screen.getByRole("button", { name: "Remove Blocked" }))

    expect(getValues().states).toEqual(["registered"])
    expect(screen.queryByRole("button", { name: "Remove Blocked" })).not.toBeInTheDocument()
  })

  test("narrows the list to what the filter matches, case-insensitively", () => {
    renderMultiSelect()

    openList()
    fireEvent.change(screen.getByRole("searchbox", { name: "Search options" }), {
      target: { value: "sub" },
    })

    expect(screen.getAllByRole("option")).toHaveLength(1)
    expect(screen.getByRole("option", { name: "Submitting" })).toBeInTheDocument()
  })

  test("keeps a picked value that the filter hides", () => {
    const { getValues } = renderMultiSelect(["blocked"])

    const trigger = screen.getByRole("button", { name: /State/ })
    fireEvent.click(trigger)
    fireEvent.change(screen.getByRole("searchbox", { name: "Search options" }), {
      target: { value: "sub" },
    })

    expect(screen.queryByRole("option", { name: "Blocked" })).not.toBeInTheDocument()
    expect(getValues().states).toEqual(["blocked"])

    fireEvent.click(trigger)

    expect(screen.getByRole("button", { name: "Remove Blocked" })).toBeInTheDocument()
  })
})
