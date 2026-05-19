"use client"

import { fireEvent, screen } from "@testing-library/react"
import type React from "react"

import { Switch } from "../src/components/Switch"

import { pressSpace, renderBooleanField, renderWithForm } from "./testUtils"

describe("Switch", () => {
  test("exposes the switch role and accessible name", () => {
    renderBooleanField((control) => <Switch name="f" control={control} label="Enable alerts" />)

    expect(screen.getByRole("switch", { name: "Enable alerts" })).toBeInTheDocument()
  })

  test("updates RHF value on click", () => {
    const { getValues } = renderBooleanField((control) => (
      <Switch name="f" control={control} label="Share profile" />
    ))

    const input = screen.getByRole("switch", { name: "Share profile" })
    fireEvent.click(input)
    expect(getValues().f).toBe(true)
  })

  test("supports keyboard space toggling", () => {
    renderBooleanField((control) => <Switch name="f" control={control} label="Keyboard" />)
    const input = screen.getByRole("switch", { name: "Keyboard" })
    pressSpace(input)
    expect(input).toBeChecked()
  })

  test("keeps native click state in sync after a keyboard toggle", () => {
    renderBooleanField((control) => <Switch name="f" control={control} label="Sync switch" />)
    const input = screen.getByRole("switch", { name: "Sync switch" })

    pressSpace(input)
    expect(input).toBeChecked()

    fireEvent.click(input)
    expect(input).not.toBeChecked()
  })

  test("honors readOnly disabled invalid and required", () => {
    const { getValues } = renderWithForm<{ ro: boolean; d: boolean; i: boolean }>(
      (control) => (
        <>
          <Switch name="ro" control={control} label="Read only" isReadOnly />
          <Switch name="d" control={control} label="Disabled" isDisabled />
          <Switch
            name="i"
            control={control}
            label="Invalid"
            errorMessage="This is invalid"
            isRequired
          />
        </>
      ),
      { defaultValues: { ro: false, d: false, i: false } },
    )

    const readOnlySwitch = screen.getByRole("switch", { name: "Read only" })
    fireEvent.click(readOnlySwitch)
    expect(getValues().ro).toBe(false)

    expect(screen.getByRole("switch", { name: "Disabled" })).toBeDisabled()
    expect(screen.getByRole("switch", { name: "Invalid" })).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("switch", { name: "Invalid" })).toBeRequired()
  })

  test("keeps className on root", () => {
    renderBooleanField((control) => (
      <Switch name="f" control={control} label="Class switch" className="switch-root" />
    ))
    expect(document.querySelector(".switch-root")).toBeInTheDocument()
  })

  test("ignores runtime type overrides", () => {
    const SwitchWithRuntimeTypeOverride = Switch as unknown as React.ComponentType<{
      name: string
      control: unknown
      label: string
      type: string
    }>

    renderBooleanField((control) => (
      <SwitchWithRuntimeTypeOverride name="f" control={control} label="Type override" type="text" />
    ))

    expect(screen.getByRole("switch", { name: "Type override" })).toHaveAttribute(
      "type",
      "checkbox",
    )
  })
})
