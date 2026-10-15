"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useForm } from "react-hook-form"

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

type Story = StoryObj<typeof Select>

const countryOptions = [
  { value: "fi", label: "Finland" },
  { value: "se", label: "Sweden" },
  { value: "no", label: "Norway" },
]

function ControlledSelectStory() {
  const { control } = useForm<{ letter: string }>({ defaultValues: { letter: "b" } })

  return (
    <Select
      name="letter"
      control={control}
      label="Controlled"
      options={[
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
        { value: "c", label: "Option C" },
      ]}
    />
  )
}

function PlaygroundStory() {
  const { control } = useForm<{ country: string }>({ defaultValues: { country: "fi" } })

  return <Select name="country" control={control} label="Country" options={countryOptions} />
}

function StatesStory() {
  const { control } = useForm<{ default: string; disabled: string; invalid: string }>({
    defaultValues: { default: "", disabled: "", invalid: "" },
  })

  return (
    <div className={stackCss}>
      <Select
        name="default"
        control={control}
        label="Default"
        options={[
          { value: "1", label: "One" },
          { value: "2", label: "Two" },
        ]}
        placeholder="Choose"
      />
      <Select
        name="disabled"
        control={control}
        label="Disabled"
        options={[{ value: "1", label: "One" }]}
        isDisabled
      />
      <Select
        name="invalid"
        control={control}
        label="Invalid"
        options={[
          { value: "1", label: "One" },
          { value: "2", label: "Two" },
        ]}
        placeholder="Choose"
        errorMessage="Selection required"
      />
    </div>
  )
}

export const Playground = {
  render: () => <PlaygroundStory />,
} satisfies Story

export const States = {
  render: () => <StatesStory />,
} satisfies Story

export const Controlled = {
  render: () => <ControlledSelectStory />,
} satisfies Story
