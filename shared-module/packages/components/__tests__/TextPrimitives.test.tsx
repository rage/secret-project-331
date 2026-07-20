"use client"

import { fireEvent, screen } from "@testing-library/react"

import { TextArea } from "../src/components/TextArea"
import { TextField } from "../src/components/TextField"
import { renderWithForm } from "./testUtils"

interface F {
  f: string
}

describe("TextField", () => {
  test("renders label, description, and error wiring", () => {
    renderWithForm<F>(
      (control) => (
        <TextField
          name="f"
          control={control}
          label="Email"
          description="Use your work address"
          errorMessage="Email is required"
        />
      ),
      { defaultValues: { f: "" } },
    )

    const input = screen.getByLabelText("Email")
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute("aria-describedby")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(screen.queryByText("Use your work address")).not.toBeInTheDocument()
    expect(screen.getByText("Email is required")).toBeInTheDocument()
  })

  test("updates RHF value on change and keeps className on the root", () => {
    const { getValues } = renderWithForm<F>(
      (control) => (
        <TextField
          name="f"
          control={control}
          label="Name"
          className="field-root"
          iconEnd={<span>!</span>}
        />
      ),
      { defaultValues: { f: "" } },
    )

    const input = screen.getByLabelText("Name")
    fireEvent.change(input, { target: { value: "Ada" } })

    expect(getValues().f).toBe("Ada")
    expect(document.querySelector(".field-root")).toBeInTheDocument()
  })
})

describe("TextArea", () => {
  test("supports floating field appearance", () => {
    renderWithForm<F>((control) => <TextArea name="f" control={control} label="Message" />, {
      defaultValues: { f: "Hello" },
    })
    expect(screen.getByLabelText("Message")).toBeInTheDocument()
  })
})
