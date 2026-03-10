"use client"

import { fireEvent, screen } from "@testing-library/react"

import { TextArea } from "../src/components/TextArea"

import { renderUi } from "./testUtils"

type Size = "sm" | "md" | "lg"

describe("TextArea – accessibility wiring", () => {
  test("label is associated with the textarea", () => {
    renderUi(<TextArea label="Bio" />)
    const textarea = screen.getByLabelText("Bio")
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName).toBe("TEXTAREA")
  })

  test("textarea has the textbox role", () => {
    renderUi(<TextArea label="Bio" />)
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  test("description is wired via aria-describedby", () => {
    renderUi(<TextArea label="Bio" description="Tell us about yourself." />)
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Tell us about yourself.")
  })

  test("errorMessage renders an alert and sets aria-invalid", () => {
    renderUi(<TextArea label="Bio" errorMessage="Too short." />)
    const textarea = screen.getByRole("textbox")
    expect(textarea).toHaveAttribute("aria-invalid", "true")
    expect(textarea).toHaveAccessibleDescription("Too short.")
    expect(screen.getByRole("alert")).toHaveTextContent("Too short.")
  })

  test("errorMessage takes precedence over description", () => {
    renderUi(<TextArea label="Bio" description="Help." errorMessage="Too short." />)
    expect(screen.getByRole("alert")).toHaveTextContent("Too short.")
    expect(screen.queryByText("Help.")).not.toBeInTheDocument()
  })

  test("isInvalid marks the field invalid without an error message", () => {
    renderUi(<TextArea label="Bio" isInvalid />)
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true")
  })

  test("isRequired / required marks the field required", () => {
    renderUi(<TextArea label="Bio" required />)
    expect(screen.getByRole("textbox")).toBeRequired()
  })

  test("isRequired alias also marks the field required", () => {
    renderUi(<TextArea label="Bio" isRequired />)
    expect(screen.getByRole("textbox")).toBeRequired()
  })

  test("user aria-describedby is preserved alongside hook-generated ids", () => {
    renderUi(
      <>
        <div id="custom-hint">External hint</div>
        <TextArea label="Bio" description="Help." aria-describedby="custom-hint" />
      </>,
    )
    const textarea = screen.getByRole("textbox")
    const describedBy = textarea.getAttribute("aria-describedby") ?? ""
    expect(describedBy.split(" ")).toContain("custom-hint")
  })

  test("placeholder is always set to a single space for the floating-label trigger", () => {
    renderUi(<TextArea label="Bio" placeholder="ignored" />)
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", " ")
  })
})

describe("TextArea – floating label behavior (DOM state)", () => {
  test("starts at rest when empty and unfocused", () => {
    const { container } = renderUi(<TextArea label="Bio" />)
    const control = container.firstChild?.firstChild as HTMLElement
    expect(control).toHaveAttribute("data-floated", "false")
    expect(control).toHaveAttribute("data-filled", "false")
    expect(control).toHaveAttribute("data-focused", "false")
  })

  test("floats on focus and returns to rest on blur when empty", () => {
    const { container } = renderUi(<TextArea label="Bio" />)
    const control = container.firstChild?.firstChild as HTMLElement
    const textarea = screen.getByRole("textbox")

    fireEvent.focus(textarea)
    expect(control).toHaveAttribute("data-focused", "true")
    expect(control).toHaveAttribute("data-floated", "true")

    fireEvent.blur(textarea)
    expect(control).toHaveAttribute("data-focused", "false")
    expect(control).toHaveAttribute("data-floated", "false")
  })

  test("starts floated when defaultValue is present", () => {
    const { container } = renderUi(<TextArea label="Bio" defaultValue="Hello" />)
    const control = container.firstChild?.firstChild as HTMLElement
    expect(control).toHaveAttribute("data-filled", "true")
    expect(control).toHaveAttribute("data-floated", "true")
  })

  test("controlled value: floats when non-empty, returns to rest when empty", () => {
    const { container, rerender } = renderUi(<TextArea label="Bio" value="Hello" />)
    const control = container.firstChild?.firstChild as HTMLElement
    expect(control).toHaveAttribute("data-filled", "true")
    expect(control).toHaveAttribute("data-floated", "true")

    rerender(<TextArea label="Bio" value="" />)
    expect(control).toHaveAttribute("data-filled", "false")
    expect(control).toHaveAttribute("data-floated", "false")
  })

  test("uncontrolled change: becomes filled when user types and returns when emptied", () => {
    const { container } = renderUi(<TextArea label="Bio" />)
    const control = container.firstChild?.firstChild as HTMLElement
    const textarea = screen.getByRole("textbox")

    fireEvent.change(textarea, { target: { value: "x" } })
    expect(control).toHaveAttribute("data-filled", "true")
    expect(control).toHaveAttribute("data-floated", "true")

    fireEvent.change(textarea, { target: { value: "" } })
    expect(control).toHaveAttribute("data-filled", "false")
    expect(control).toHaveAttribute("data-floated", "false")
  })

  test("invalid state is reflected in data-invalid", () => {
    const { container } = renderUi(<TextArea label="Bio" errorMessage="Bad" />)
    const control = container.firstChild?.firstChild as HTMLElement
    expect(control).toHaveAttribute("data-invalid", "true")
  })
})

describe("TextArea – disabled and read-only states", () => {
  test("disabled prop disables the textarea", () => {
    renderUi(<TextArea label="Bio" disabled />)
    expect(screen.getByRole("textbox")).toBeDisabled()
  })

  test("isDisabled alias disables the textarea", () => {
    renderUi(<TextArea label="Bio" isDisabled />)
    expect(screen.getByRole("textbox")).toBeDisabled()
  })

  test("readOnly prop makes the textarea read-only", () => {
    renderUi(<TextArea label="Bio" readOnly />)
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly")
  })

  test("isReadOnly alias makes the textarea read-only", () => {
    renderUi(<TextArea label="Bio" isReadOnly />)
    expect(screen.getByRole("textbox")).toHaveAttribute("readonly")
  })
})

describe("TextArea – event handling", () => {
  test("onChange fires with a native ChangeEvent", () => {
    const onChange = jest.fn()
    renderUi(<TextArea label="Bio" onChange={onChange} />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello" } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].target.value).toBe("Hello")
  })

  test("ref is forwarded to the textarea element", () => {
    const ref = { current: null as HTMLTextAreaElement | null }
    renderUi(<TextArea label="Bio" ref={ref} />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.tagName).toBe("TEXTAREA")
  })
})

describe("TextArea – className and structure", () => {
  test("className is applied to the root div, not the textarea", () => {
    const { container } = renderUi(<TextArea label="Bio" className="my-area" />)
    const root = container.firstChild as HTMLElement
    expect(root.classList).toContain("my-area")
    expect(screen.getByRole("textbox").classList).not.toContain("my-area")
  })

  test("renders a label element with the correct text", () => {
    renderUi(<TextArea label="Message body" />)
    expect(screen.getByText("Message body").tagName).toBe("LABEL")
  })

  test("no description or error renders no message paragraph", () => {
    const { container } = renderUi(<TextArea label="Bio" />)
    expect(container.querySelector("p")).toBeNull()
  })
})

describe("TextArea – icon slots", () => {
  test("iconStart renders with aria-hidden and does not affect accessible name", () => {
    renderUi(<TextArea label="Notes" iconStart={<span data-testid="icon-start">📝</span>} />)
    const iconWrapper = screen.getByTestId("icon-start").closest("span[aria-hidden]")
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument()
  })

  test("iconEnd renders with aria-hidden and does not affect accessible name", () => {
    renderUi(<TextArea label="Notes" iconEnd={<span data-testid="icon-end">✕</span>} />)
    const iconWrapper = screen.getByTestId("icon-end").closest("span[aria-hidden]")
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument()
  })

  test("iconStart sets data-has-icon-start on the control wrapper", () => {
    const { container } = renderUi(<TextArea label="Notes" iconStart={<span>📝</span>} />)
    const control = container.firstChild?.firstChild as HTMLElement
    expect(control).toHaveAttribute("data-has-icon-start", "true")
  })
})

describe("TextArea – size variants", () => {
  const sizes: Size[] = ["sm", "md", "lg"]

  test.each(sizes)("size %s renders without crashing and applies a class", (size) => {
    renderUi(<TextArea label="Bio" fieldSize={size} />)
    const textarea = screen.getByRole("textbox")
    expect(textarea).toBeInTheDocument()
    expect(textarea.getAttribute("class")).toBeTruthy()
  })
})

describe("TextArea – auto-resize", () => {
  function mockScrollHeight(el: Element, value: number) {
    Object.defineProperty(el, "scrollHeight", { value, configurable: true, writable: true })
  }

  test("autoResize sets height on initial render via useEffect (value-triggered)", () => {
    const { rerender } = renderUi(<TextArea label="Bio" autoResize value="" />)
    const textarea = screen.getByRole("textbox")
    mockScrollHeight(textarea, 80)

    // Simulate a controlled value change which drives the effect
    rerender(<TextArea label="Bio" autoResize value="New content" />)

    expect(textarea.style.height).toBe("80px")
    expect(textarea.style.overflowY).toBe("hidden")
  })

  test("autoResize clamps height to autoResizeMaxHeightPx", () => {
    const { rerender } = renderUi(
      <TextArea label="Bio" autoResize autoResizeMaxHeightPx={50} value="" />,
    )
    const textarea = screen.getByRole("textbox")
    mockScrollHeight(textarea, 200)

    rerender(<TextArea label="Bio" autoResize autoResizeMaxHeightPx={50} value="Tall content" />)

    expect(textarea.style.height).toBe("50px")
    expect(textarea.style.overflowY).toBe("auto")
  })

  test("autoResize applies height during change event (uncontrolled path)", () => {
    renderUi(<TextArea label="Bio" autoResize />)
    const textarea = screen.getByRole("textbox")
    mockScrollHeight(textarea, 120)

    fireEvent.change(textarea, { target: { value: "Some text" } })

    expect(textarea.style.height).toBe("120px")
  })

  test("onAutoResized is called when height changes", () => {
    const onAutoResized = jest.fn()
    const { rerender } = renderUi(
      <TextArea label="Bio" autoResize onAutoResized={onAutoResized} value="" />,
    )
    const textarea = screen.getByRole("textbox")
    mockScrollHeight(textarea, 90)

    rerender(<TextArea label="Bio" autoResize onAutoResized={onAutoResized} value="Content" />)

    expect(onAutoResized).toHaveBeenCalled()
  })

  test("onChange still fires when autoResize is enabled", () => {
    const onChange = jest.fn()
    renderUi(<TextArea label="Bio" autoResize onChange={onChange} />)
    const textarea = screen.getByRole("textbox")

    fireEvent.change(textarea, { target: { value: "Hello" } })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].target.value).toBe("Hello")
  })

  test("autoResize disabled: height is not managed", () => {
    renderUi(<TextArea label="Bio" autoResize={false} />)
    const textarea = screen.getByRole("textbox")

    fireEvent.change(textarea, { target: { value: "Some text" } })

    expect(textarea.style.height).toBe("")
  })
})
