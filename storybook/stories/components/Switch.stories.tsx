"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"

import { Switch } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
`

const meta = {
  title: "Components/Switch",
  component: Switch,
  args: {
    label: "Enable notifications",
  },
} satisfies Meta<typeof Switch>

export default meta

type Story = StoryObj<typeof meta>

function ControlledSwitchStory() {
  const [checked, setChecked] = useState(true)

  return (
    <Switch
      label={`Controlled (${checked ? "on" : "off"})`}
      checked={checked}
      onChange={(event) => setChecked(event.currentTarget.checked)}
    />
  )
}

export const Playground = {} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <Switch label="Default" />
      <Switch label="Checked" defaultChecked />
      <Switch label="Disabled" disabled />
      <Switch label="Invalid" errorMessage="This setting is required" />
    </div>
  ),
} satisfies Story

export const Controlled = {
  render: () => <ControlledSwitchStory />,
} satisfies Story
