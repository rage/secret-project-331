"use client"

import { fireEvent, screen } from "@testing-library/react"

import { Switch } from "../src/components/Switch"

import { pressSpace, renderUi } from "./testUtils"

describe("Switch", () => {
  test("exposes the switch role and accessible name", () => {
    renderUi(<Switch label="Enable alerts" />)

    expect(screen.getByRole("switch", { name: "Enable alerts" })).toBeInTheDocument()
  })

  test("supports uncontrolled state changes", () => {
    renderUi(<Switch label="Share profile" defaultChecked />)

    const input = screen.getByRole("switch", { name: "Share profile" })
    expect(input).toBeChecked()

    fireEvent.click(input)
    expect(input).not.toBeChecked()
  })

  test("fires onChange in controlled mode", () => {
    const onChange = jest.fn()

    const { rerender } = renderUi(
      <Switch label="Beta access" checked={false} onChange={onChange} />,
    )
    const input = screen.getByRole("switch", { name: "Beta access" })

    fireEvent.click(input)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(input).not.toBeChecked()

    rerender(<Switch label="Beta access" checked onChange={onChange} />)
    expect(screen.getByRole("switch", { name: "Beta access" })).toBeChecked()
  })

  test("supports keyboard space toggling", () => {
    renderUi(<Switch label="Keyboard" />)
    const input = screen.getByRole("switch", { name: "Keyboard" })
    pressSpace(input)
    expect(input).toBeChecked()
  })

  test("keeps native click state in sync after a keyboard toggle", () => {
    renderUi(<Switch label="Sync switch" />)
    const input = screen.getByRole("switch", { name: "Sync switch" })

    pressSpace(input)
    expect(input).toBeChecked()

    fireEvent.click(input)
    expect(input).not.toBeChecked()
  })

  test("honors readOnly disabled invalid and required", () => {
    renderUi(
      <>
        <Switch label="Read only" defaultChecked readOnly />
        <Switch label="Disabled" disabled />
        <Switch label="Invalid" errorMessage="This is invalid" required />
      </>,
    )

    const readOnlySwitch = screen.getByRole("switch", { name: "Read only" })
    fireEvent.click(readOnlySwitch)
    expect(readOnlySwitch).toBeChecked()

    expect(screen.getByRole("switch", { name: "Disabled" })).toBeDisabled()
    expect(screen.getByRole("switch", { name: "Invalid" })).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("switch", { name: "Invalid" })).toBeRequired()
  })

  test("forwards ref and keeps className on root", () => {
    const ref = { current: null as HTMLInputElement | null }
    renderUi(<Switch ref={ref} label="Ref switch" className="switch-root" />)

    expect(ref.current).toBeInstanceOf(HTMLInputElement)
    expect(document.querySelector(".switch-root")).toBeInTheDocument()
  })
})
