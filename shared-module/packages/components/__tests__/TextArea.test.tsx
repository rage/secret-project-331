"use client"

import { act, fireEvent, render, screen } from "@testing-library/react"

import { TextArea } from "../src/components/TextArea"

import type { StringFieldForm } from "./testUtils"
import { FormHarness, renderStringField } from "./testUtils"

describe("TextArea - accessibility wiring", () => {
  test("label is associated with the textarea", () => {
    renderStringField((control) => <TextArea name="f" control={control} label="Bio" />)
    const textarea = screen.getByLabelText("Bio")
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName).toBe("TEXTAREA")
  })

  test("textarea has the textbox role", () => {
    renderStringField((control) => <TextArea name="f" control={control} label="Bio" />)
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  test("description is wired via aria-describedby", () => {
    renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" description="Tell us about yourself." />
    ))
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Tell us about yourself.")
  })

  test("errorMessage renders an alert and sets aria-invalid", () => {
    renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" errorMessage="Too short." />
    ))
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveAttribute("aria-invalid", "true")
    expect(textarea).toHaveAccessibleDescription("Too short.")
    expect(screen.getByRole("alert")).toHaveTextContent("Too short.")
  })

  test("errorMessage takes precedence over description", () => {
    renderStringField((control) => (
      <TextArea
        name="f"
        control={control}
        label="Bio"
        description="Help."
        errorMessage="Too short."
      />
    ))
    expect(screen.getByRole("alert")).toHaveTextContent("Too short.")
    expect(screen.queryByText("Help.")).not.toBeInTheDocument()
  })

  test("isRequired marks the field required", () => {
    renderStringField((control) => <TextArea name="f" control={control} label="Bio" isRequired />)
    expect(screen.getByRole("textbox")).toBeRequired()
  })

  test("placeholder is always set to a single space for the floating-label trigger", () => {
    renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" placeholder="ignored" />
    ))
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", " ")
  })
})

describe("TextArea - floating label behavior (DOM state)", () => {
  test("starts at rest when empty and unfocused", () => {
    const { container } = renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-multiline", "true")
    expect(controlEl).toHaveAttribute("data-floated", "false")
    expect(controlEl).toHaveAttribute("data-filled", "false")
    expect(controlEl).toHaveAttribute("data-focused", "false")
  })

  test("floats on focus and returns to rest on blur when empty", () => {
    const { container } = renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    const textarea = screen.getByRole("textbox")

    fireEvent.focus(textarea)
    expect(controlEl).toHaveAttribute("data-focused", "true")
    expect(controlEl).toHaveAttribute("data-floated", "true")

    fireEvent.blur(textarea)
    expect(controlEl).toHaveAttribute("data-focused", "false")
    expect(controlEl).toHaveAttribute("data-floated", "false")
  })

  test("starts floated when defaultValues has a value", () => {
    const { container } = renderStringField(
      (control) => <TextArea name="f" control={control} label="Bio" />,
      "Hello",
    )
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-filled", "true")
    expect(controlEl).toHaveAttribute("data-floated", "true")
  })

  test("controlled value: floats when non-empty, returns to rest when empty (remount)", () => {
    const { container, rerender } = render(
      <FormHarness<StringFieldForm> key="filled" defaultValues={{ f: "Hello" }}>
        {(c) => <TextArea name="f" control={c} label="Bio" />}
      </FormHarness>,
    )
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-filled", "true")
    expect(controlEl).toHaveAttribute("data-floated", "true")

    rerender(
      <FormHarness<StringFieldForm> key="empty" defaultValues={{ f: "" }}>
        {(c) => <TextArea name="f" control={c} label="Bio" />}
      </FormHarness>,
    )
    const next = container.firstChild?.firstChild as HTMLElement
    expect(next).toHaveAttribute("data-filled", "false")
    expect(next).toHaveAttribute("data-floated", "false")
  })

  test("typing updates filled state via RHF", () => {
    const { container } = renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    const textarea = screen.getByRole("textbox")

    fireEvent.change(textarea, { target: { value: "x" } })
    expect(controlEl).toHaveAttribute("data-filled", "true")
    expect(controlEl).toHaveAttribute("data-floated", "true")

    fireEvent.change(textarea, { target: { value: "" } })
    expect(controlEl).toHaveAttribute("data-filled", "false")
    expect(controlEl).toHaveAttribute("data-floated", "false")
  })

  test("invalid state is reflected in data-invalid", () => {
    const { container } = renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" errorMessage="Bad" />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-invalid", "true")
  })
})

describe("TextArea - disabled and read-only states", () => {
  test("isDisabled disables the textarea", () => {
    renderStringField((control) => <TextArea name="f" control={control} label="Bio" isDisabled />)
    expect(screen.getByRole("textbox")).toBeDisabled()
  })

  test("isReadOnly makes the textarea read-only", () => {
    renderStringField((control) => <TextArea name="f" control={control} label="Bio" isReadOnly />)
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly")
  })
})

describe("TextArea - RHF wiring", () => {
  test("change updates form state", () => {
    const { getValues } = renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" />
    ))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello" } })
    expect(getValues().f).toBe("Hello")
  })
})

describe("TextArea - className and structure", () => {
  test("className is applied to the root div, not the textarea", () => {
    const { container } = renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" className="my-area" />
    ))
    const root = container.firstChild as HTMLElement
    expect(root.classList).toContain("my-area")
    expect(screen.getByRole("textbox").classList).not.toContain("my-area")
  })

  test("renders a label element with the correct text", () => {
    renderStringField((control) => <TextArea name="f" control={control} label="Message body" />)
    expect(screen.getByText("Message body").tagName).toBe("LABEL")
  })

  test("no description or error renders no message paragraph", () => {
    const { container } = renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" />
    ))
    expect(container.querySelector("p")).toBeNull()
  })
})

describe("TextArea - icon slots", () => {
  test("iconStart renders with aria-hidden and does not affect accessible name", () => {
    renderStringField((control) => (
      <TextArea
        name="f"
        control={control}
        label="Notes"
        iconStart={<span data-testid="icon-start">📝</span>}
      />
    ))
    const iconWrapper = screen.getByTestId("icon-start").closest("span[aria-hidden]")
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument()
  })

  test("iconEnd renders with aria-hidden and does not affect accessible name", () => {
    renderStringField((control) => (
      <TextArea
        name="f"
        control={control}
        label="Notes"
        iconEnd={<span data-testid="icon-end">✕</span>}
      />
    ))
    const iconWrapper = screen.getByTestId("icon-end").closest("span[aria-hidden]")
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument()
  })

  test("iconStart sets data-has-icon-start on the control wrapper", () => {
    const { container } = renderStringField((control) => (
      <TextArea name="f" control={control} label="Notes" iconStart={<span>📝</span>} />
    ))
    const controlEl = container.firstChild?.firstChild as HTMLElement
    expect(controlEl).toHaveAttribute("data-has-icon-start", "true")
  })
})

describe("TextArea - size variants", () => {
  const sizes = ["sm", "md", "lg"] as const

  test.each(sizes)("size %s renders without crashing and applies a class", (size) => {
    renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" fieldSize={size} />
    ))
    const textarea = screen.getByRole("textbox")
    expect(textarea).toBeInTheDocument()
    expect(textarea.getAttribute("class")).toBeTruthy()
  })
})

describe("TextArea - auto-resize", () => {
  function mockScrollHeight(el: Element, value: number) {
    Object.defineProperty(el, "scrollHeight", { value, configurable: true, writable: true })
  }

  test("autoResize sets height on initial render via useEffect (value-triggered)", () => {
    const { formRef } = renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" autoResize />
    ))
    const textarea = screen.getByRole("textbox")
    mockScrollHeight(textarea, 80)

    act(() => {
      formRef.current?.setValue("f", "New content")
    })

    expect(textarea.style.height).toBe("80px")
    expect(textarea.style.overflowY).toBe("hidden")
  })

  test("autoResize clamps height to autoResizeMaxHeightPx", () => {
    const { formRef } = renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" autoResize autoResizeMaxHeightPx={50} />
    ))
    const textarea = screen.getByRole("textbox")
    mockScrollHeight(textarea, 200)

    act(() => {
      formRef.current?.setValue("f", "Tall content")
    })

    expect(textarea.style.height).toBe("50px")
    expect(textarea.style.overflowY).toBe("auto")
  })

  test("autoResize applies height during change event", () => {
    renderStringField((control) => <TextArea name="f" control={control} label="Bio" autoResize />)
    const textarea = screen.getByRole("textbox")
    mockScrollHeight(textarea, 120)

    fireEvent.change(textarea, { target: { value: "Some text" } })

    expect(textarea.style.height).toBe("120px")
  })

  test("onAutoResized is called when height changes", () => {
    const onAutoResized = jest.fn()
    const { formRef } = renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" autoResize onAutoResized={onAutoResized} />
    ))
    const textarea = screen.getByRole("textbox")
    mockScrollHeight(textarea, 90)

    act(() => {
      formRef.current?.setValue("f", "Content")
    })

    expect(onAutoResized).toHaveBeenCalled()
  })

  test("change updates RHF when autoResize is enabled", () => {
    const { getValues } = renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" autoResize />
    ))
    const textarea = screen.getByRole("textbox")

    fireEvent.change(textarea, { target: { value: "Hello" } })

    expect(getValues().f).toBe("Hello")
  })

  test("autoResize disabled: height is not managed", () => {
    renderStringField((control) => (
      <TextArea name="f" control={control} label="Bio" autoResize={false} />
    ))
    const textarea = screen.getByRole("textbox")

    fireEvent.change(textarea, { target: { value: "Some text" } })

    expect(textarea.style.height).toBe("")
  })
})
