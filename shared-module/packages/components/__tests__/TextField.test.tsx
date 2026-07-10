"use client"

import { fireEvent, render, screen } from "@testing-library/react"

import { TextField } from "../src/components/TextField"

import type { StringFieldForm } from "./testUtils"
import { FormHarness, renderStringField } from "./testUtils"

describe("TextField - accessibility wiring", () => {
  test("label is associated with the input", () => {
    renderStringField((control) => <TextField name="f" control={control} label="Email" />)
    const input = screen.getByLabelText("Email")
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe("INPUT")
  })

  test("description is wired via aria-describedby", () => {
    renderStringField((control) => (
      <TextField name="f" control={control} label="Email" description="Enter your work email." />
    ))
    const input = screen.getByRole("textbox")
    expect(input).toHaveAccessibleDescription("Enter your work email.")
  })

  test("errorMessage renders an alert and sets aria-invalid", () => {
    renderStringField((control) => (
      <TextField name="f" control={control} label="Email" errorMessage="Invalid address." />
    ))

    const input = screen.getByRole("textbox")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription("Invalid address.")

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Invalid address.")
  })

  test("errorMessage takes precedence over description", () => {
    renderStringField((control) => (
      <TextField
        name="f"
        control={control}
        label="Email"
        description="Enter your email."
        errorMessage="Invalid address."
      />
    ))
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid address.")
    expect(screen.queryByText("Enter your email.")).not.toBeInTheDocument()
  })

  test("isRequired marks the field required", () => {
    renderStringField((control) => (
      <TextField name="f" control={control} label="Email" isRequired />
    ))
    expect(screen.getByRole("textbox")).toBeRequired()
  })

  test("placeholder is always set to a single space for the floating-label trigger", () => {
    renderStringField((control) => (
      <TextField name="f" control={control} label="Name" placeholder="ignored" />
    ))
    const input = screen.getByRole("textbox")
    expect(input).toHaveAttribute("placeholder", " ")
  })
})

describe("TextField - floating label behavior (DOM state)", () => {
  test("starts at rest when empty and unfocused", () => {
    const { container } = renderStringField((control) => (
      <TextField name="f" control={control} label="Email" />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-floated", "false")
    expect(controlEl).toHaveAttribute("data-filled", "false")
    expect(controlEl).toHaveAttribute("data-focused", "false")
  })

  test("floats on focus and returns to rest on blur when empty", () => {
    const { container } = renderStringField((control) => (
      <TextField name="f" control={control} label="Email" />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    const input = screen.getByRole("textbox")

    fireEvent.focus(input)
    expect(controlEl).toHaveAttribute("data-focused", "true")
    expect(controlEl).toHaveAttribute("data-floated", "true")

    fireEvent.blur(input)
    expect(controlEl).toHaveAttribute("data-focused", "false")
    expect(controlEl).toHaveAttribute("data-floated", "false")
  })

  test("starts floated when defaultValues has a value", () => {
    const { container } = renderStringField(
      (control) => <TextField name="f" control={control} label="Email" />,
      "a@b.com",
    )
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-filled", "true")
    expect(controlEl).toHaveAttribute("data-floated", "true")
  })

  test("controlled value: floats when non-empty, returns to rest when empty (remount)", () => {
    const { container, rerender } = render(
      <FormHarness<StringFieldForm> key="filled" defaultValues={{ f: "a@b.com" }}>
        {(c) => <TextField name="f" control={c} label="Email" />}
      </FormHarness>,
    )
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-filled", "true")
    expect(controlEl).toHaveAttribute("data-floated", "true")

    rerender(
      <FormHarness<StringFieldForm> key="empty" defaultValues={{ f: "" }}>
        {(c) => <TextField name="f" control={c} label="Email" />}
      </FormHarness>,
    )
    const controlAfter = container.firstChild?.firstChild as HTMLElement
    expect(controlAfter).toHaveAttribute("data-filled", "false")
    expect(controlAfter).toHaveAttribute("data-floated", "false")
  })

  test("typing updates filled state via RHF", () => {
    const { container } = renderStringField((control) => (
      <TextField name="f" control={control} label="Email" />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    const input = screen.getByRole("textbox")

    fireEvent.change(input, { target: { value: "x" } })
    expect(controlEl).toHaveAttribute("data-filled", "true")
    expect(controlEl).toHaveAttribute("data-floated", "true")

    fireEvent.change(input, { target: { value: "" } })
    expect(controlEl).toHaveAttribute("data-filled", "false")
    expect(controlEl).toHaveAttribute("data-floated", "false")
  })

  test("invalid state is reflected in data-invalid", () => {
    const { container } = renderStringField((control) => (
      <TextField name="f" control={control} label="Email" errorMessage="Bad" />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-invalid", "true")
  })
})

describe("TextField - disabled and read-only states", () => {
  test("isDisabled disables the input", () => {
    renderStringField((control) => <TextField name="f" control={control} label="Name" isDisabled />)
    expect(screen.getByRole("textbox")).toBeDisabled()
  })

  test("isReadOnly makes the input read-only", () => {
    renderStringField((control) => <TextField name="f" control={control} label="Name" isReadOnly />)
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly")
  })
})

describe("TextField - RHF wiring", () => {
  test("change updates form state", () => {
    const { getValues } = renderStringField((control) => (
      <TextField name="f" control={control} label="Name" />
    ))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Alice" } })
    expect(getValues().f).toBe("Alice")
  })
})

describe("TextField - className and structure", () => {
  test("className is applied to the root div, not the input", () => {
    const { container } = renderStringField((control) => (
      <TextField name="f" control={control} label="Name" className="my-field" />
    ))
    const root = container.firstChild as HTMLElement
    expect(root.classList).toContain("my-field")
    expect(screen.getByRole("textbox").classList).not.toContain("my-field")
  })

  test("renders a label element with the correct text", () => {
    renderStringField((control) => <TextField name="f" control={control} label="Email address" />)
    expect(screen.getByText("Email address").tagName).toBe("LABEL")
  })

  test("no description or error renders no message paragraph", () => {
    const { container } = renderStringField((control) => (
      <TextField name="f" control={control} label="Name" />
    ))
    expect(container.querySelector("p")).toBeNull()
  })

  test("description renders a paragraph when no error is present", () => {
    const { container } = renderStringField((control) => (
      <TextField name="f" control={control} label="Name" description="Hint." />
    ))
    const p = container.querySelector("p")
    expect(p).not.toBeNull()
    expect(p).toHaveTextContent("Hint.")
    expect(p).not.toHaveAttribute("role")
  })
})

describe("TextField - icon slots", () => {
  test("iconStart renders with aria-hidden and does not affect accessible name", () => {
    renderStringField((control) => (
      <TextField
        name="f"
        control={control}
        label="Search"
        iconStart={<span data-testid="icon-start">🔍</span>}
      />
    ))
    const iconWrapper = screen.getByTestId("icon-start").closest("span[aria-hidden]")
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument()
  })

  test("iconEnd renders with aria-hidden and does not affect accessible name", () => {
    renderStringField((control) => (
      <TextField
        name="f"
        control={control}
        label="Password"
        iconEnd={<span data-testid="icon-end">👁</span>}
      />
    ))
    const iconWrapper = screen.getByTestId("icon-end").closest("span[aria-hidden]")
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByRole("textbox", { name: "Password" })).toBeInTheDocument()
  })

  test("iconStart sets data-has-icon-start on the control wrapper", () => {
    const { container } = renderStringField((control) => (
      <TextField name="f" control={control} label="Search" iconStart={<span>🔍</span>} />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-has-icon-start", "true")
  })

  test("iconEnd sets data-has-icon-end on the control wrapper", () => {
    const { container } = renderStringField((control) => (
      <TextField name="f" control={control} label="Search" iconEnd={<span>✕</span>} />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-has-icon-end", "true")
  })

  test("no icon means no data-has-icon-* attributes", () => {
    const { container } = renderStringField((control) => (
      <TextField name="f" control={control} label="Name" />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).not.toHaveAttribute("data-has-icon-start")
    expect(controlEl).not.toHaveAttribute("data-has-icon-end")
  })
})

describe("TextField - size variants", () => {
  const sizes = ["sm", "md", "lg"] as const

  test.each(sizes)("size %s renders without crashing and applies a class", (size) => {
    renderStringField((control) => (
      <TextField name="f" control={control} label="Name" fieldSize={size} />
    ))
    const input = screen.getByRole("textbox")
    expect(input).toBeInTheDocument()
    expect(input.getAttribute("class")).toBeTruthy()
  })
})
