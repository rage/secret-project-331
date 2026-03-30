"use client"

import { fireEvent, screen } from "@testing-library/react"

import { TextField } from "../src/components/TextField"

import { renderUi } from "./testUtils"

type Size = "sm" | "md" | "lg"

describe("TextField – accessibility wiring", () => {
  test("label is associated with the input", () => {
    renderUi(<TextField label="Email" />)
    // getByLabelText locates via htmlFor ↔ id linkage set up by useTextField
    const input = screen.getByLabelText("Email")
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe("INPUT")
  })

  test("description is wired via aria-describedby", () => {
    renderUi(<TextField label="Email" description="Enter your work email." />)
    const input = screen.getByRole("textbox")
    expect(input).toHaveAccessibleDescription("Enter your work email.")
  })

  test("errorMessage renders an alert and sets aria-invalid", () => {
    renderUi(<TextField label="Email" errorMessage="Invalid address." />)

    const input = screen.getByRole("textbox")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription("Invalid address.")

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Invalid address.")
  })

  test("errorMessage takes precedence over description", () => {
    renderUi(
      <TextField label="Email" description="Enter your email." errorMessage="Invalid address." />,
    )
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid address.")
    expect(screen.queryByText("Enter your email.")).not.toBeInTheDocument()
  })

  test("isInvalid marks the field invalid without an error message", () => {
    renderUi(<TextField label="Email" isInvalid />)
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true")
  })

  test("isRequired / required marks the field required", () => {
    renderUi(<TextField label="Email" required />)
    expect(screen.getByRole("textbox")).toBeRequired()
  })

  test("isRequired alias also marks the field required", () => {
    renderUi(<TextField label="Email" isRequired />)
    expect(screen.getByRole("textbox")).toBeRequired()
  })

  test("user aria-describedby is preserved alongside hook-generated ids", () => {
    renderUi(
      <>
        <div id="custom-hint">Custom hint</div>
        <TextField label="Email" description="Help text." aria-describedby="custom-hint" />
      </>,
    )
    const input = screen.getByRole("textbox")
    const describedBy = input.getAttribute("aria-describedby") ?? ""
    expect(describedBy.split(" ")).toContain("custom-hint")
  })

  test("placeholder is always set to a single space for the floating-label trigger", () => {
    renderUi(<TextField label="Name" placeholder="ignored" />)
    const input = screen.getByRole("textbox")
    expect(input).toHaveAttribute("placeholder", " ")
  })
})

describe("TextField – floating label behavior (DOM state)", () => {
  test("starts at rest when empty and unfocused", () => {
    const { container } = renderUi(<TextField label="Email" />)
    const control = container.firstChild?.firstChild as HTMLElement
    expect(control).toHaveAttribute("data-floated", "false")
    expect(control).toHaveAttribute("data-filled", "false")
    expect(control).toHaveAttribute("data-focused", "false")
  })

  test("floats on focus and returns to rest on blur when empty", () => {
    const { container } = renderUi(<TextField label="Email" />)
    const control = container.firstChild?.firstChild as HTMLElement
    const input = screen.getByRole("textbox")

    fireEvent.focus(input)
    expect(control).toHaveAttribute("data-focused", "true")
    expect(control).toHaveAttribute("data-floated", "true")

    fireEvent.blur(input)
    expect(control).toHaveAttribute("data-focused", "false")
    expect(control).toHaveAttribute("data-floated", "false")
  })

  test("starts floated when defaultValue is present", () => {
    const { container } = renderUi(<TextField label="Email" defaultValue="a@b.com" />)
    const control = container.firstChild?.firstChild as HTMLElement
    expect(control).toHaveAttribute("data-filled", "true")
    expect(control).toHaveAttribute("data-floated", "true")
  })

  test("controlled value: floats when non-empty, returns to rest when empty", () => {
    const { container, rerender } = renderUi(<TextField label="Email" value="a@b.com" />)
    const control = container.firstChild?.firstChild as HTMLElement
    expect(control).toHaveAttribute("data-filled", "true")
    expect(control).toHaveAttribute("data-floated", "true")

    rerender(<TextField label="Email" value="" />)
    expect(control).toHaveAttribute("data-filled", "false")
    expect(control).toHaveAttribute("data-floated", "false")
  })

  test("uncontrolled change: becomes filled when user types and returns when emptied", () => {
    const { container } = renderUi(<TextField label="Email" />)
    const control = container.firstChild?.firstChild as HTMLElement
    const input = screen.getByRole("textbox")

    fireEvent.change(input, { target: { value: "x" } })
    expect(control).toHaveAttribute("data-filled", "true")
    expect(control).toHaveAttribute("data-floated", "true")

    fireEvent.change(input, { target: { value: "" } })
    expect(control).toHaveAttribute("data-filled", "false")
    expect(control).toHaveAttribute("data-floated", "false")
  })

  test("invalid state is reflected in data-invalid", () => {
    const { container } = renderUi(<TextField label="Email" errorMessage="Bad" />)
    const control = container.firstChild?.firstChild as HTMLElement
    expect(control).toHaveAttribute("data-invalid", "true")
  })
})

describe("TextField – disabled and read-only states", () => {
  test("disabled prop disables the input", () => {
    renderUi(<TextField label="Name" disabled />)
    expect(screen.getByRole("textbox")).toBeDisabled()
  })

  test("isDisabled alias disables the input", () => {
    renderUi(<TextField label="Name" isDisabled />)
    expect(screen.getByRole("textbox")).toBeDisabled()
  })

  test("readOnly prop makes the input read-only", () => {
    renderUi(<TextField label="Name" readOnly />)
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly")
  })

  test("isReadOnly alias makes the input read-only", () => {
    renderUi(<TextField label="Name" isReadOnly />)
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly")
  })
})

describe("TextField – event handling", () => {
  test("onChange fires with a native ChangeEvent", () => {
    const onChange = jest.fn()
    renderUi(<TextField label="Name" onChange={onChange} />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Alice" } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].target.value).toBe("Alice")
  })

  test("ref is forwarded to the input element", () => {
    const ref = { current: null as HTMLInputElement | null }
    renderUi(<TextField label="Name" ref={ref} />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe("INPUT")
  })
})

describe("TextField – className and structure", () => {
  test("className is applied to the root div, not the input", () => {
    const { container } = renderUi(<TextField label="Name" className="my-field" />)
    const root = container.firstChild as HTMLElement
    expect(root.classList).toContain("my-field")
    expect(screen.getByRole("textbox").classList).not.toContain("my-field")
  })

  test("renders a label element with the correct text", () => {
    renderUi(<TextField label="Email address" />)
    expect(screen.getByText("Email address").tagName).toBe("LABEL")
  })

  test("no description or error renders no message paragraph", () => {
    const { container } = renderUi(<TextField label="Name" />)
    expect(container.querySelector("p")).toBeNull()
  })

  test("description renders a paragraph when no error is present", () => {
    const { container } = renderUi(<TextField label="Name" description="Hint." />)
    const p = container.querySelector("p")
    expect(p).not.toBeNull()
    expect(p).toHaveTextContent("Hint.")
    expect(p).not.toHaveAttribute("role")
  })
})

describe("TextField – icon slots", () => {
  test("iconStart renders with aria-hidden and does not affect accessible name", () => {
    renderUi(<TextField label="Search" iconStart={<span data-testid="icon-start">🔍</span>} />)
    const iconWrapper = screen.getByTestId("icon-start").closest("span[aria-hidden]")
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument()
  })

  test("iconEnd renders with aria-hidden and does not affect accessible name", () => {
    renderUi(<TextField label="Password" iconEnd={<span data-testid="icon-end">👁</span>} />)
    const iconWrapper = screen.getByTestId("icon-end").closest("span[aria-hidden]")
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByRole("textbox", { name: "Password" })).toBeInTheDocument()
  })

  test("iconStart sets data-has-icon-start on the control wrapper", () => {
    const { container } = renderUi(<TextField label="Search" iconStart={<span>🔍</span>} />)
    // The control wrapper is the direct child of the root
    const control = container.firstChild?.firstChild as HTMLElement
    expect(control).toHaveAttribute("data-has-icon-start", "true")
  })

  test("iconEnd sets data-has-icon-end on the control wrapper", () => {
    const { container } = renderUi(<TextField label="Search" iconEnd={<span>✕</span>} />)
    const control = container.firstChild?.firstChild as HTMLElement
    expect(control).toHaveAttribute("data-has-icon-end", "true")
  })

  test("no icon means no data-has-icon-* attributes", () => {
    const { container } = renderUi(<TextField label="Name" />)
    const control = container.firstChild?.firstChild as HTMLElement
    expect(control).not.toHaveAttribute("data-has-icon-start")
    expect(control).not.toHaveAttribute("data-has-icon-end")
  })
})

describe("TextField – size variants", () => {
  const sizes: Size[] = ["sm", "md", "lg"]

  test.each(sizes)("size %s renders without crashing and applies a class", (size) => {
    renderUi(<TextField label="Name" fieldSize={size} />)
    const input = screen.getByRole("textbox")
    expect(input).toBeInTheDocument()
    expect(input.getAttribute("class")).toBeTruthy()
  })
})
