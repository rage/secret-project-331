"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useForm, useWatch } from "react-hook-form"

import { Switch } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
`

function PlaygroundStory() {
  const { control } = useForm<{ enabled: boolean }>({ defaultValues: { enabled: false } })

  return <Switch name="enabled" control={control} label="Enable notifications" />
}

function StatesStory() {
  const { control } = useForm<{
    default: boolean
    checked: boolean
    disabled: boolean
    invalid: boolean
  }>({
    defaultValues: { default: false, checked: true, disabled: false, invalid: false },
  })

  return (
    <div className={stackCss}>
      <Switch name="default" control={control} label="Default" />
      <Switch name="checked" control={control} label="Checked" />
      <Switch name="disabled" control={control} label="Disabled" isDisabled />
      <Switch name="invalid" control={control} label="Invalid" errorMessage="This setting is required" />
    </div>
  )
}

function ControlledSwitchStory() {
  const { control } = useForm<{ enabled: boolean }>({ defaultValues: { enabled: true } })
  const enabled = useWatch({ control, name: "enabled" })

  return (
    <Switch
      name="enabled"
      control={control}
      label={`Controlled (${enabled ? "on" : "off"})`}
    />
  )
}

const meta = {
  title: "Components/Switch",
  component: Switch,
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof Switch>

export const Playground = {
  render: () => <PlaygroundStory />,
} satisfies Story

export const States = {
  render: () => <StatesStory />,
} satisfies Story

export const Controlled = {
  render: () => <ControlledSwitchStory />,
} satisfies Story
