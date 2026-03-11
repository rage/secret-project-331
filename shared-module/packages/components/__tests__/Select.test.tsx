"use client"

/* eslint-disable i18next/no-literal-string */

import { fireEvent, screen } from "@testing-library/react"

import { Select } from "../src/components/Select"

import { renderUi } from "./testUtils"

describe("Select", () => {
  test("renders label and description wiring", () => {
    renderUi(
      <Select label="Country" description="Select your country">
        <option value="">Choose</option>
        <option value="fi">Finland</option>
      </Select>,
    )

    const select = screen.getByLabelText("Country")
    expect(select).toBeInTheDocument()
    expect(select).toHaveAttribute("aria-describedby")
    expect(screen.getByText("Select your country")).toBeInTheDocument()
  })

  test("supports uncontrolled selection", () => {
    renderUi(
      <Select label="Role" defaultValue="admin">
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </Select>,
    )

    const select = screen.getByLabelText("Role")
    expect(select).toHaveValue("admin")

    fireEvent.change(select, { target: { value: "user" } })
    expect(select).toHaveValue("user")
  })

  test("supports controlled selection", () => {
    const onChange = jest.fn()
    const { rerender } = renderUi(
      <Select label="Language" value="fi" onChange={onChange}>
        <option value="fi">Finnish</option>
        <option value="en">English</option>
      </Select>,
    )

    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "en" } })
    expect(onChange).toHaveBeenCalledTimes(1)

    rerender(
      <Select label="Language" value="en" onChange={onChange}>
        <option value="fi">Finnish</option>
        <option value="en">English</option>
      </Select>,
    )

    expect(screen.getByLabelText("Language")).toHaveValue("en")
  })

  test("supports disabled and invalid behavior", () => {
    renderUi(
      <>
        <Select label="Disabled" disabled>
          <option value="x">X</option>
        </Select>
        <Select label="Invalid" errorMessage="Required">
          <option value="">Choose</option>
        </Select>
      </>,
    )

    expect(screen.getByLabelText("Disabled")).toBeDisabled()
    expect(screen.getByLabelText("Invalid")).toHaveAttribute("aria-invalid", "true")
  })
})
