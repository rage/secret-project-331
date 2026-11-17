"use client"

import { act, fireEvent, screen } from "@testing-library/react"
import type React from "react"
import { useForm } from "react-hook-form"

import { Radio } from "../src/components/Radio"
import { RadioGroup } from "../src/components/RadioGroup"
import { renderUi, renderWithForm } from "./testUtils"

describe("Radio nested content and hiding", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test("reveals nested content only for the selected option", () => {
    renderWithForm<{ r: string }>(
      (control) => (
        <RadioGroup name="r" control={control} label="Where">
          <Radio label="Here" value="here" nestedContent={<a href="#x">Link an exam</a>} />
          <Radio label="Elsewhere" value="elsewhere" />
        </RadioGroup>
      ),
      { defaultValues: { r: "elsewhere" } },
    )

    expect(screen.queryByRole("link", { name: "Link an exam" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("radio", { name: "Here" }))
    expect(screen.getByRole("link", { name: "Link an exam" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("radio", { name: "Elsewhere" }))
    act(() => {
      jest.runAllTimers()
    })
    expect(screen.queryByRole("link", { name: "Link an exam" })).not.toBeInTheDocument()
  })

  test("removes a hidden option after its exit transition", () => {
    const { rerender } = renderUi(<HideHarness isHidden={false} />)
    expect(screen.getByRole("radio", { name: "Teacher adds" })).toBeInTheDocument()

    rerender(<HideHarness isHidden />)
    act(() => {
      jest.runAllTimers()
    })
    expect(screen.queryByRole("radio", { name: "Teacher adds" })).not.toBeInTheDocument()
  })
})

function HideHarness({ isHidden }: { isHidden: boolean }) {
  return (
    <RadioGroupWithForm>
      <Radio label="By requirements" value="req" />
      <Radio label="Teacher adds" value="teacher" isHidden={isHidden} />
    </RadioGroupWithForm>
  )
}

function RadioGroupWithForm({ children }: { children: React.ReactNode }) {
  const { control } = useForm<{ r: string }>({ defaultValues: { r: "req" } })
  return (
    <RadioGroup name="r" control={control} label="How">
      {children}
    </RadioGroup>
  )
}
