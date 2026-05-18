"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"

import { Select } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 360px;
`

const meta = {
  title: "Components/Select",
  component: Select,
  parameters: {
    docs: {
      description: {
        component:
          "Custom select built on React Aria `useSelect`: the visible trigger is a native `button` (not `role=combobox` on the trigger). Screen readers still get the correct listbox relationship via React Aria; keyboard support follows the WAI-ARIA listbox pattern.",
      },
    },
  },
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

const countryOptions = [
  { value: "fi", label: "Finland" },
  { value: "se", label: "Sweden" },
  { value: "no", label: "Norway" },
]

function ControlledSelectStory() {
  const [value, setValue] = useState("b")

  return (
    <Select
      label="Controlled"
      options={[
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
        { value: "c", label: "Option C" },
      ]}
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  )
}

export const Playground = {
  render: () => <Select defaultValue="fi" label="Country" options={countryOptions} />,
} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <Select
        label="Default"
        options={[
          { value: "1", label: "One" },
          { value: "2", label: "Two" },
        ]}
        placeholder="Choose"
      />
      <Select disabled label="Disabled" options={[{ value: "1", label: "One" }]} />
      <Select
        errorMessage="Selection required"
        label="Invalid"
        options={[
          { value: "1", label: "One" },
          { value: "2", label: "Two" },
        ]}
        placeholder="Choose"
      />
    </div>
  ),
} satisfies Story

export const Controlled = {
  render: () => <ControlledSelectStory />,
} satisfies Story
