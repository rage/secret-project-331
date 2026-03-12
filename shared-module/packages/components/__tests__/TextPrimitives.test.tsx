"use client"

/* eslint-disable i18next/no-literal-string */

import { fireEvent, screen } from "@testing-library/react"

import { TextArea } from "../src/components/TextArea"
import { TextField } from "../src/components/TextField"

import { renderUi } from "./testUtils"

describe("TextField", () => {
  test("renders label, description, and error wiring", () => {
    renderUi(
      <TextField
        label="Email"
        description="Use your work address"
        errorMessage="Email is required"
        defaultValue=""
      />,
    )

    const input = screen.getByLabelText("Email")
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute("aria-describedby")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(screen.queryByText("Use your work address")).not.toBeInTheDocument()
    expect(screen.getByText("Email is required")).toBeInTheDocument()
  })

  test("calls onChange and keeps className on the root", () => {
    const onChange = jest.fn()

    renderUi(
      <TextField
        label="Name"
        className="field-root"
        onChange={onChange}
        iconEnd={<span>!</span>}
      />,
    )

    const input = screen.getByLabelText("Name")
    fireEvent.change(input, { target: { value: "Ada" } })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(document.querySelector(".field-root")).toBeInTheDocument()
  })
})

describe("TextArea", () => {
  test("supports floating field appearance", () => {
    renderUi(<TextArea label="Message" defaultValue="Hello" />)
    expect(screen.getByLabelText("Message")).toBeInTheDocument()
  })

  test("supports plain appearance", () => {
    renderUi(<TextArea label="Notes" appearance="plain" />)
    expect(screen.getByLabelText("Notes")).toBeInTheDocument()
  })
})
