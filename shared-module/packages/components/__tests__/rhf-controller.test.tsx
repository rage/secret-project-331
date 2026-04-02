"use client"

import { fireEvent, screen } from "@testing-library/react"

import { ComboBox } from "../src/components/ComboBox"
import { Radio } from "../src/components/Radio"
import { RadioGroup } from "../src/components/RadioGroup"

import { renderWithForm } from "./testUtils"

describe("react-hook-form embedded controller integration", () => {
  test("updates RadioGroup form value", () => {
    const { getValues } = renderWithForm<{ level: string }>(
      (control) => (
        <RadioGroup name="level" control={control} label="Level">
          <Radio value="beginner" label="Beginner" />
          <Radio value="advanced" label="Advanced" />
        </RadioGroup>
      ),
      { defaultValues: { level: "beginner" } },
    )
    const advanced = screen.getByRole("radio", { name: "Advanced" })
    fireEvent.click(advanced)
    expect(advanced).toBeChecked()
    expect(getValues().level).toBe("advanced")
  })

  test("updates ComboBox form value", () => {
    const { getValues } = renderWithForm<{ category: string | null }>(
      (control) => (
        <ComboBox<{ id: string; name: string }, { category: string | null }>
          name="category"
          control={control}
          label="Category"
          items={[
            { id: "a", name: "Alpha" },
            { id: "b", name: "Beta" },
          ]}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.name}
        />
      ),
      { defaultValues: { category: null } },
    )

    fireEvent.click(screen.getByLabelText("Toggle options"))
    fireEvent.click(screen.getByRole("option", { name: "Beta" }))
    expect(getValues().category).toBe("b")
  })
})
