"use client"

import { act, fireEvent, screen, within } from "@testing-library/react"

import { Select } from "../src/components/Select"

import { renderUi } from "./testUtils"

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
    renderUi(<Select description="Select your country" label="Country" options={countryOptions} />)

    const select = screen.getByRole("button", { name: /Country/ })
    expect(select).toBeInTheDocument()
    expect(select.tagName).toBe("BUTTON")
    expect(select).toHaveAttribute("aria-describedby")
    expect(screen.getByText("Select your country")).toBeInTheDocument()
  })

  test("supports uncontrolled selection", () => {
    renderUi(<Select defaultValue="admin" label="Role" options={roleOptions} />)

    const select = screen.getByRole("button", { name: /Role/ })
    expect(select).toHaveTextContent("Admin")

    fireEvent.click(select)
    fireEvent.click(screen.getByRole("option", { name: "User" }))
    expect(select).toHaveTextContent("User")
  })

  test("supports controlled selection", () => {
    const onChange = jest.fn()
    const { rerender } = renderUi(
      <Select label="Language" onChange={onChange} options={languageOptions} value="fi" />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Language/ }))
    fireEvent.click(screen.getByRole("option", { name: "English" }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].currentTarget.value).toBe("en")

    rerender(<Select label="Language" onChange={onChange} options={languageOptions} value="en" />)

    expect(screen.getByRole("button", { name: /Language/ })).toHaveTextContent("English")
  })

  test("renders with no option selected when initial controlled value is empty", () => {
    renderUi(
      <Select
        label="Priority"
        onChange={() => {}}
        options={[
          { value: "low", label: "Low" },
          { value: "high", label: "High" },
        ]}
        placeholder="Choose priority"
        value=""
      />,
    )

    const trigger = screen.getByRole("button", { name: /Priority/ })
    expect(within(trigger).queryByText("Low")).not.toBeInTheDocument()
    expect(within(trigger).queryByText("High")).not.toBeInTheDocument()
  })

  test("clears a controlled value back to the placeholder", () => {
    const { rerender } = renderUi(
      <Select
        label="Priority"
        onChange={() => {}}
        options={[
          { value: "low", label: "Low" },
          { value: "high", label: "High" },
        ]}
        placeholder="Choose priority"
        value="high"
      />,
    )

    const trigger = screen.getByRole("button", { name: /Priority/ })
    expect(trigger).toHaveTextContent("High")

    rerender(
      <Select
        label="Priority"
        onChange={() => {}}
        options={[
          { value: "low", label: "Low" },
          { value: "high", label: "High" },
        ]}
        placeholder="Choose priority"
        value=""
      />,
    )

    expect(trigger).toHaveTextContent("Choose priority")
    expect(within(trigger).queryByText("High")).not.toBeInTheDocument()
  })

  test("keeps unmatched controlled values in controlled mode", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})
    const onChange = jest.fn()
    const { rerender } = renderUi(
      <Select
        label="Language"
        onChange={onChange}
        options={languageOptions}
        placeholder="Choose language"
        value="sv"
      />,
    )

    const trigger = screen.getByRole("button", { name: /Language/ })
    expect(trigger).toHaveTextContent("Choose language")

    rerender(
      <Select
        label="Language"
        onChange={onChange}
        options={languageOptions}
        placeholder="Choose language"
        value="fi"
      />,
    )
    expect(trigger).toHaveTextContent("Finnish")

    rerender(
      <Select
        label="Language"
        onChange={onChange}
        options={languageOptions}
        placeholder="Choose language"
        value="sv"
      />,
    )
    expect(trigger).toHaveTextContent("Choose language")
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  test("calls onBlur after focus leaves the open listbox", () => {
    const onBlur = jest.fn()

    renderUi(
      <>
        <Select label="Language" onBlur={onBlur} options={languageOptions} />
        <button type="button">Outside</button>
      </>,
    )

    const trigger = screen.getByRole("button", { name: /Language/ })
    const outsideButton = screen.getByRole("button", { name: "Outside" })

    fireEvent.click(trigger)

    const listbox = screen.getByRole("listbox")
    act(() => {
      listbox.focus()
      outsideButton.focus()
    })

    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  test("supports disabled and invalid behavior", () => {
    renderUi(
      <>
        <Select disabled label="Disabled" options={[{ value: "x", label: "X" }]} />
        <Select errorMessage="Required" label="Invalid" options={countryOptions} />
      </>,
    )

    expect(screen.getByRole("button", { name: /Disabled/ })).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent("Required")
  })
})
