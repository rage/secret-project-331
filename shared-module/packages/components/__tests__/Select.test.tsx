"use client"

import { act, fireEvent, screen, within } from "@testing-library/react"

import { Select } from "../src/components/Select"

import { renderWithForm } from "./testUtils"

const countryOptions = [
  { value: "", label: "Choose" },
  { value: "fi", label: "Finland" },
] as const

const roleOptions = [
  { value: "user", label: "User" },
  { value: "admin", label: "Admin" },
] as const

const languageOptions = [
  { value: "fi", label: "Finnish" },
  { value: "en", label: "English" },
] as const

describe("Select", () => {
  test("renders label and description wiring", () => {
    renderWithForm<{ s: string }>((control) => (
      <Select
        name="s"
        control={control}
        description="Select your country"
        label="Country"
        options={countryOptions}
      />
    ))

    const select = screen.getByRole("button", { name: /Country/ })
    expect(select).toBeInTheDocument()
    expect(select.tagName).toBe("BUTTON")
    expect(select).toHaveAttribute("aria-describedby")
    expect(screen.getByText("Select your country")).toBeInTheDocument()
  })

  test("updates RHF value on selection", () => {
    const { getValues } = renderWithForm<{ s: string }>(
      (control) => <Select name="s" control={control} label="Role" options={roleOptions} />,
      { defaultValues: { s: "admin" } },
    )

    const select = screen.getByRole("button", { name: /Role/ })
    expect(select).toHaveTextContent("Admin")

    fireEvent.click(select)
    fireEvent.click(screen.getByRole("option", { name: "User" }))
    expect(select).toHaveTextContent("User")
    expect(getValues().s).toBe("user")
  })

  test("renders with no option selected when initial value is empty", () => {
    renderWithForm<{ s: string }>(
      (control) => (
        <Select
          name="s"
          control={control}
          label="Priority"
          options={[
            { value: "low", label: "Low" },
            { value: "high", label: "High" },
          ]}
          placeholder="Choose priority"
        />
      ),
      { defaultValues: { s: "" } },
    )

    const trigger = screen.getByRole("button", { name: /Priority/ })
    expect(within(trigger).queryByText("Low")).not.toBeInTheDocument()
    expect(within(trigger).queryByText("High")).not.toBeInTheDocument()
  })

  test("clears selected value back to placeholder", () => {
    const { getValues, formRef } = renderWithForm<{ s: string }>(
      (control) => (
        <Select
          name="s"
          control={control}
          label="Priority"
          options={[
            { value: "low", label: "Low" },
            { value: "high", label: "High" },
          ]}
          placeholder="Choose priority"
        />
      ),
      { defaultValues: { s: "high" } },
    )

    const trigger = screen.getByRole("button", { name: /Priority/ })
    expect(trigger).toHaveTextContent("High")

    act(() => formRef.current?.setValue("s", ""))

    expect(trigger).toHaveTextContent("Choose priority")
    expect(within(trigger).queryByText("High")).not.toBeInTheDocument()
    expect(getValues().s).toBe("")
  })

  test("keeps unmatched values without warning", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})
    const { formRef } = renderWithForm<{ s: string }>(
      (control) => (
        <Select
          name="s"
          control={control}
          label="Language"
          options={languageOptions}
          placeholder="Choose language"
        />
      ),
      { defaultValues: { s: "sv" } },
    )

    const trigger = screen.getByRole("button", { name: /Language/ })
    expect(trigger).toHaveTextContent("Choose language")

    act(() => formRef.current?.setValue("s", "fi"))
    expect(trigger).toHaveTextContent("Finnish")

    act(() => formRef.current?.setValue("s", "sv"))
    expect(trigger).toHaveTextContent("Choose language")
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  test("calls onBlur after focus leaves the open listbox", () => {
    renderWithForm<{ s: string }>((control) => (
      <>
        <Select name="s" control={control} label="Language" options={languageOptions} />
        <button type="button">Outside</button>
      </>
    ))

    const trigger = screen.getByRole("button", { name: /Language/ })
    const outsideButton = screen.getByRole("button", { name: "Outside" })

    fireEvent.click(trigger)

    const listbox = screen.getByRole("listbox")
    act(() => {
      listbox.focus()
      outsideButton.focus()
    })

    expect(trigger).toHaveAttribute("aria-labelledby")
  })

  test("supports disabled and invalid behavior", () => {
    renderWithForm<{ d: string; i: string }>((control) => (
      <>
        <Select
          name="d"
          control={control}
          isDisabled
          label="Disabled"
          options={[{ value: "x", label: "X" }]}
        />
        <Select
          name="i"
          control={control}
          errorMessage="Required"
          label="Invalid"
          options={countryOptions}
        />
      </>
    ))

    expect(screen.getByRole("button", { name: /Disabled/ })).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent("Required")
  })

  test("rejects duplicate option values", () => {
    expect(() =>
      renderWithForm<{ s: string }>((control) => (
        <Select
          name="s"
          control={control}
          label="Duplicate values"
          options={[
            { value: "dup", label: "First" },
            { value: "dup", label: "Second" },
          ]}
        />
      )),
    ).toThrow(/unique values/i)
  })
})
