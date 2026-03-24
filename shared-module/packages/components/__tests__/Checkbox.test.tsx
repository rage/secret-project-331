"use client"

import { fireEvent, screen } from "@testing-library/react"

import { Checkbox } from "../src/components/Checkbox"

import { pressSpace, renderUi } from "./testUtils"

describe("Checkbox", () => {
  test("renders with label association", () => {
    renderUi(<Checkbox label="Accept terms" />)
    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeInTheDocument()
  })

  test("supports controlled and uncontrolled behavior", () => {
    const onChange = jest.fn()
    const { rerender } = renderUi(
      <Checkbox label="Controlled" defaultChecked={false} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole("checkbox", { name: "Controlled" }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("checkbox", { name: "Controlled" })).toBeChecked()

    rerender(<Checkbox label="Controlled" checked onChange={onChange} />)
    expect(screen.getByRole("checkbox", { name: "Controlled" })).toBeChecked()
  })

  test("does not invoke consumer onChange when readOnly", () => {
    const onChange = jest.fn()
    renderUi(<Checkbox label="Read only" readOnly onChange={onChange} />)
    fireEvent.click(screen.getByRole("checkbox", { name: "Read only" }))
    expect(onChange).not.toHaveBeenCalled()
  })

  test("supports indeterminate state", () => {
    renderUi(<Checkbox label="Partially selected" isIndeterminate />)
    const input = screen.getByRole("checkbox", { name: "Partially selected" }) as HTMLInputElement
    expect(input.indeterminate).toBe(true)
    expect(input).toHaveAttribute("aria-checked", "mixed")
  })

  test("supports keyboard space toggling", () => {
    renderUi(<Checkbox label="Keyboard checkbox" />)
    const input = screen.getByRole("checkbox", { name: "Keyboard checkbox" })
    pressSpace(input)
    expect(input).toBeChecked()
  })

  test("keeps native click state in sync after a keyboard toggle", () => {
    renderUi(<Checkbox label="Sync checkbox" />)
    const input = screen.getByRole("checkbox", { name: "Sync checkbox" })

    pressSpace(input)
    expect(input).toBeChecked()

    fireEvent.click(input)
    expect(input).not.toBeChecked()
  })

  test("honors disabled invalid and required states", () => {
    renderUi(
      <>
        <Checkbox label="Disabled" disabled />
        <Checkbox label="Invalid" required errorMessage="Required" />
      </>,
    )

    expect(screen.getByRole("checkbox", { name: "Disabled" })).toBeDisabled()
    expect(screen.getByRole("checkbox", { name: "Invalid" })).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    expect(screen.getByRole("checkbox", { name: "Invalid" })).toBeRequired()
  })

  test("forwards ref and keeps className on root", () => {
    const ref = { current: null as HTMLInputElement | null }
    renderUi(<Checkbox ref={ref} label="Ref checkbox" className="checkbox-root" />)

    expect(ref.current).toBeInstanceOf(HTMLInputElement)
    expect(document.querySelector(".checkbox-root")).toBeInTheDocument()
  })
})
