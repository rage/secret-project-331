"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react"

import { TimeField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 320px;
`

const meta = {
  title: "Components/TimeField",
  component: TimeField,
  args: {
    label: "Start time",
    defaultValue: "09:30",
  },
} satisfies Meta<typeof TimeField>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <TimeField label="Default" />
      <TimeField label="Disabled" disabled defaultValue="09:30" />
      <TimeField label="Invalid" errorMessage="Time is required" />
    </div>
  ),
} satisfies Story
