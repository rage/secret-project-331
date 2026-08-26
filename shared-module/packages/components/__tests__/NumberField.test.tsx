"use client"

import { fireEvent, render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"

import { NumberField } from "../src/components/NumberField"
import type { NumberFieldForm } from "./testUtils"
import { domClick, renderNumberField } from "./testUtils"

function FocusHarness({ withOutsideButton = false }: { withOutsideButton?: boolean }) {
  const { control, formState } = useForm<NumberFieldForm>({ defaultValues: { f: 1 } })
  return (
    <>
      <NumberField name="f" control={control} label="Quantity" />
      <span data-testid="touched">{formState.touchedFields.f ? "touched" : "untouched"}</span>
      {withOutsideButton ? <button type="button">outside</button> : null}
    </>
  )
}

function TwoFields() {
  const { control } = useForm<{ a: number | null; b: number | null }>({
    defaultValues: { a: 1, b: 1 },
  })
  return (
    <>
      <NumberField name="a" control={control} label="Width" />
      <NumberField name="b" control={control} label="Height" />
    </>
  )
}

function StringDefault() {
  // Not-yet-migrated callers may still hand this field a numeric string, matching the
  // tolerance TextField already has for that shape.
  const { control } = useForm<{ f: string | number | null }>({ defaultValues: { f: "5" } })
  return <NumberField name="f" control={control as never} label="Quantity" />
}

describe("NumberField - accessibility wiring", () => {
  test("label is associated with the input", () => {
    renderNumberField((control) => <NumberField name="f" control={control} label="Quantity" />)
    const input = screen.getByLabelText("Quantity")
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe("INPUT")
  })

  test("description is wired via aria-describedby", () => {
    renderNumberField((control) => (
      <NumberField name="f" control={control} label="Quantity" description="How many items." />
    ))
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("How many items.")
  })

  test("errorMessage renders an alert and sets aria-invalid", () => {
    renderNumberField((control) => (
      <NumberField name="f" control={control} label="Quantity" errorMessage="Required." />
    ))
    const input = screen.getByRole("textbox")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("alert")).toHaveTextContent("Required.")
  })

  test("isRequired marks the field required", () => {
    renderNumberField((control) => (
      <NumberField name="f" control={control} label="Quantity" isRequired />
    ))
    expect(screen.getByRole("textbox")).toBeRequired()
  })

  test("increment and decrement buttons have accessible labels", () => {
    renderNumberField((control) => <NumberField name="f" control={control} label="Quantity" />)
    expect(screen.getByRole("button", { name: "Increase Quantity" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Decrease Quantity" })).toBeInTheDocument()
  })

  test("stepper labels include each field's own label, not a shared generic string", () => {
    render(<TwoFields />)
    expect(screen.getByRole("button", { name: "Increase Width" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Increase Height" })).toBeInTheDocument()
  })
})

describe("NumberField - floating label behavior (DOM state)", () => {
  test("starts at rest when empty and unfocused", () => {
    const { container } = renderNumberField((control) => (
      <NumberField name="f" control={control} label="Quantity" />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-floated", "false")
    expect(controlEl).toHaveAttribute("data-filled", "false")
  })

  test("starts floated when defaultValues has a value", () => {
    const { container } = renderNumberField(
      (control) => <NumberField name="f" control={control} label="Quantity" />,
      3,
    )
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-filled", "true")
    expect(controlEl).toHaveAttribute("data-floated", "true")
  })

  test("typing updates filled state immediately; the form commits the parsed number on blur", () => {
    const { container, getValues } = renderNumberField((control) => (
      <NumberField name="f" control={control} label="Quantity" />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    const input = screen.getByRole("textbox")

    fireEvent.change(input, { target: { value: "5" } })
    expect(controlEl).toHaveAttribute("data-filled", "true")

    fireEvent.blur(input)
    expect(getValues().f).toBe(5)
  })

  test("clearing the input commits null, not NaN", () => {
    const { getValues } = renderNumberField(
      (control) => <NumberField name="f" control={control} label="Quantity" />,
      5,
    )
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "" } })
    fireEvent.blur(input)
    expect(getValues().f).toBeNull()
  })

  test("renders a numeric-string external value instead of a blank field", () => {
    render(<StringDefault />)
    expect(screen.getByRole("textbox")).toHaveValue("5")
  })
})

describe("NumberField - commitBehavior", () => {
  test("snaps a typed value to the step by default", () => {
    const { getValues } = renderNumberField(
      (control) => (
        <NumberField name="f" control={control} label="Quantity" maxValue={1} step={0.1} />
      ),
      1,
    )
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "0.75" } })
    fireEvent.blur(input)
    expect(getValues().f).toBe(0.7)
  })

  test('keeps a typed off-step value with commitBehavior="validate"', () => {
    const { getValues } = renderNumberField(
      (control) => (
        <NumberField
          name="f"
          control={control}
          label="Quantity"
          maxValue={1}
          step={0.1}
          commitBehavior="validate"
        />
      ),
      1,
    )
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "0.75" } })
    fireEvent.blur(input)
    expect(getValues().f).toBe(0.75)
  })
})

describe("NumberField - stepper buttons", () => {
  test("increment button raises the value and commits it to the form", () => {
    const { getValues } = renderNumberField(
      (control) => <NumberField name="f" control={control} label="Quantity" step={1} />,
      1,
    )
    domClick(screen.getByRole("button", { name: "Increase Quantity" }))
    expect(getValues().f).toBe(2)
  })

  test("decrement button lowers the value and commits it to the form", () => {
    const { getValues } = renderNumberField(
      (control) => <NumberField name="f" control={control} label="Quantity" step={1} />,
      1,
    )
    domClick(screen.getByRole("button", { name: "Decrease Quantity" }))
    expect(getValues().f).toBe(0)
  })

  test("decrement button is disabled at minValue", () => {
    renderNumberField(
      (control) => <NumberField name="f" control={control} label="Quantity" minValue={0} />,
      0,
    )
    expect(screen.getByRole("button", { name: "Decrease Quantity" })).toBeDisabled()
  })
})

describe("NumberField - focus handling across the input and stepper buttons (issue #1756)", () => {
  test("moving focus from the input to the increment button does not commit blur", () => {
    render(<FocusHarness />)
    const input = screen.getByRole("textbox")
    const incrementButton = screen.getByRole("button", { name: "Increase Quantity" })

    fireEvent.focusIn(input)
    fireEvent.focusOut(input, { relatedTarget: incrementButton })
    fireEvent.focusIn(incrementButton)

    expect(screen.getByTestId("touched")).toHaveTextContent("untouched")
  })

  test("moving focus out of the whole field commits blur", () => {
    render(<FocusHarness withOutsideButton />)
    const input = screen.getByRole("textbox")
    const outside = screen.getByRole("button", { name: "outside" })

    fireEvent.focusIn(input)
    fireEvent.focusOut(input, { relatedTarget: outside })

    expect(screen.getByTestId("touched")).toHaveTextContent("touched")
  })
})

describe("NumberField - disabled and read-only states", () => {
  test("isDisabled disables the input", () => {
    renderNumberField((control) => (
      <NumberField name="f" control={control} label="Quantity" isDisabled />
    ))
    expect(screen.getByRole("textbox")).toBeDisabled()
  })

  test("isReadOnly makes the input read-only", () => {
    renderNumberField((control) => (
      <NumberField name="f" control={control} label="Quantity" isReadOnly />
    ))
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly")
  })
})

describe("NumberField - className and structure", () => {
  test("className is applied to the root div, not the input", () => {
    const { container } = renderNumberField((control) => (
      <NumberField name="f" control={control} label="Quantity" className="my-field" />
    ))
    const root = container.firstChild as HTMLElement
    expect(root.classList).toContain("my-field")
    expect(screen.getByRole("textbox").classList).not.toContain("my-field")
  })
})

describe("NumberField - size variants", () => {
  const sizes = ["sm", "md", "lg"] as const

  test.each(sizes)("size %s renders without crashing", (size) => {
    renderNumberField((control) => (
      <NumberField name="f" control={control} label="Quantity" fieldSize={size} />
    ))
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })
})
