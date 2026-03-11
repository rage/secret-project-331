"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react"
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
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

function ControlledSelectStory() {
  const [value, setValue] = useState("b")

  return (
    <Select
      label="Controlled"
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
    >
      <option value="a">Option A</option>
      <option value="b">Option B</option>
      <option value="c">Option C</option>
    </Select>
  )
}

export const Playground = {
  render: () => (
    <Select label="Country" defaultValue="fi">
      <option value="fi">Finland</option>
      <option value="se">Sweden</option>
      <option value="no">Norway</option>
    </Select>
  ),
} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <Select label="Default">
        <option value="">Choose</option>
        <option value="1">One</option>
      </Select>
      <Select label="Disabled" disabled>
        <option value="1">One</option>
      </Select>
      <Select label="Invalid" errorMessage="Selection required">
        <option value="">Choose</option>
        <option value="1">One</option>
      </Select>
    </div>
  ),
} satisfies Story

export const Controlled = {
  render: () => <ControlledSelectStory />,
} satisfies Story
