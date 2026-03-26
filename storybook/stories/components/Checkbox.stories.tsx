"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Checkbox } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
`

const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  args: {
    label: "Accept terms",
  },
} satisfies Meta<typeof Checkbox>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <Checkbox label="Default" />
      <Checkbox label="Checked" defaultChecked />
      <Checkbox label="Indeterminate" isIndeterminate />
      <Checkbox label="Disabled" disabled />
      <Checkbox label="Invalid" errorMessage="Required" />
    </div>
  ),
} satisfies Story
