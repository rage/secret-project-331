"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"

import { Radio, RadioGroup } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 24px;
`

const meta = {
  title: "Components/RadioGroup",
  component: RadioGroup,
} satisfies Meta<typeof RadioGroup>

export default meta

type Story = StoryObj<typeof meta>

function ControlledRadioGroupStory() {
  const [value, setValue] = useState("alpha")

  return (
    <RadioGroup label="Controlled" value={value} onChange={setValue}>
      <Radio label="Alpha" value="alpha" />
      <Radio label="Beta" value="beta" />
    </RadioGroup>
  )
}

export const Vertical = {
  render: () => (
    <RadioGroup label="Theme" defaultValue="light">
      <Radio label="Light" value="light" />
      <Radio label="Dark" value="dark" />
      <Radio label="System" value="system" />
    </RadioGroup>
  ),
} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <RadioGroup label="Delivery speed" errorMessage="Choose one">
        <Radio label="Standard" value="standard" />
        <Radio label="Express" value="express" />
      </RadioGroup>
      <RadioGroup label="Orientation" orientation="horizontal" defaultValue="left">
        <Radio label="Left" value="left" />
        <Radio label="Right" value="right" />
      </RadioGroup>
    </div>
  ),
} satisfies Story

export const Controlled = {
  render: () => <ControlledRadioGroupStory />,
} satisfies Story
