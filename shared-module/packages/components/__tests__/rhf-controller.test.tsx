"use client"

import { fireEvent, screen } from "@testing-library/react"
import { Controller, useForm } from "react-hook-form"

import { ComboBox } from "../src/components/ComboBox"
import { Radio } from "../src/components/Radio"
import { RadioGroup } from "../src/components/RadioGroup"

import { renderUi } from "./testUtils"

function ControllerForm() {
  const { control, handleSubmit } = useForm({
    defaultValues: {
      category: "a",
      level: "beginner",
    },
  })

  return (
    <form onSubmit={handleSubmit(() => undefined)}>
      <Controller
        name="category"
        control={control}
        render={({ field }) => (
          <ComboBox
            label="Category"
            items={[
              { id: "a", name: "Alpha" },
              { id: "b", name: "Beta" },
            ]}
            getItemKey={(item) => item.id}
            getItemTextValue={(item) => item.name}
            selectedKey={field.value}
            onSelectionChange={field.onChange}
          />
        )}
      />

      <Controller
        name="level"
        control={control}
        render={({ field }) => (
          <RadioGroup label="Level" value={field.value} onChange={field.onChange}>
            <Radio value="beginner" label="Beginner" />
            <Radio value="advanced" label="Advanced" />
          </RadioGroup>
        )}
      />

      <button type="submit">Submit</button>
    </form>
  )
}

describe("react-hook-form Controller integration", () => {
  test("updates controlled RadioGroup value", () => {
    renderUi(<ControllerForm />)
    const advanced = screen.getByRole("radio", { name: "Advanced" })
    fireEvent.click(advanced)
    expect(advanced).toBeChecked()
  })
})
