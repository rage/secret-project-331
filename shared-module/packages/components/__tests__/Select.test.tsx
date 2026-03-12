"use client"

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
    expect(select.tagName).toBe("BUTTON")
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
    expect(select).toHaveTextContent("Admin")

    fireEvent.click(select)
    fireEvent.click(screen.getByRole("option", { name: "User" }))
    expect(select).toHaveTextContent("User")
  })

  test("supports controlled selection", () => {
    const onChange = jest.fn()
    const { rerender } = renderUi(
      <Select label="Language" value="fi" onChange={onChange}>
        <option value="fi">Finnish</option>
        <option value="en">English</option>
      </Select>,
    )

    fireEvent.click(screen.getByLabelText("Language"))
    fireEvent.click(screen.getByRole("option", { name: "English" }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].currentTarget.value).toBe("en")

    rerender(
      <Select label="Language" value="en" onChange={onChange}>
        <option value="fi">Finnish</option>
        <option value="en">English</option>
      </Select>,
    )

    expect(screen.getByLabelText("Language")).toHaveTextContent("English")
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
