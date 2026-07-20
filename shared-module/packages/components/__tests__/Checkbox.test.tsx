"use client"

import { fireEvent, screen } from "@testing-library/react"

import { Checkbox } from "../src/components/Checkbox"
import { pressSpace, renderBooleanField, renderWithForm } from "./testUtils"

describe("Checkbox", () => {
  test("renders with label association", () => {
    renderBooleanField((control) => <Checkbox name="f" control={control} label="Accept terms" />)
    expect(screen.getByRole("checkbox", { name: "Accept terms" })).toBeInTheDocument()
  })

  test("updates RHF value on click", () => {
    const { getValues } = renderBooleanField((control) => (
      <Checkbox name="f" control={control} label="RHF checkbox" />
    ))

    fireEvent.click(screen.getByRole("checkbox", { name: "RHF checkbox" }))
    expect(getValues().f).toBe(true)
  })

  test("does not update RHF value when isReadOnly", () => {
    const { getValues } = renderBooleanField((control) => (
      <Checkbox name="f" control={control} label="Read only" isReadOnly />
    ))

    fireEvent.click(screen.getByRole("checkbox", { name: "Read only" }))
    expect(getValues().f).toBe(false)
  })

  test("supports indeterminate state", () => {
    renderBooleanField((control) => (
      <Checkbox name="f" control={control} label="Partially selected" isIndeterminate />
    ))
    const input = screen.getByRole("checkbox", { name: "Partially selected" }) as HTMLInputElement
    expect(input.indeterminate).toBe(true)
    expect(input).not.toBeChecked()
  })

  test("supports keyboard space toggling", () => {
    renderBooleanField((control) => (
      <Checkbox name="f" control={control} label="Keyboard checkbox" />
    ))
    const input = screen.getByRole("checkbox", { name: "Keyboard checkbox" })
    pressSpace(input)
    expect(input).toBeChecked()
  })

  test("keeps native click state in sync after a keyboard toggle", () => {
    renderBooleanField((control) => <Checkbox name="f" control={control} label="Sync checkbox" />)
    const input = screen.getByRole("checkbox", { name: "Sync checkbox" })

    pressSpace(input)
    expect(input).toBeChecked()

    fireEvent.click(input)
    expect(input).not.toBeChecked()
  })

  test("honors disabled invalid and required states", () => {
    renderWithForm<{ c: boolean; d: boolean }>((control) => (
      <>
        <Checkbox name="d" control={control} label="Disabled" isDisabled />
        <Checkbox name="c" control={control} label="Invalid" isRequired errorMessage="Required" />
      </>
    ))

    expect(screen.getByRole("checkbox", { name: "Disabled" })).toBeDisabled()
    expect(screen.getByRole("checkbox", { name: "Invalid" })).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    expect(screen.getByRole("checkbox", { name: "Invalid" })).toBeRequired()
  })

  test("keeps className on root", () => {
    renderBooleanField((control) => (
      <Checkbox name="f" control={control} label="Class checkbox" className="checkbox-root" />
    ))

    expect(document.querySelector(".checkbox-root")).toBeInTheDocument()
  })
})
