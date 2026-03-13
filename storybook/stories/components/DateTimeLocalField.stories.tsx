"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react"

import { DateTimeLocalField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 360px;
`

const meta = {
  title: "Components/DateTimeLocalField",
  component: DateTimeLocalField,
  args: {
    label: "Publish at",
    defaultValue: "2026-03-11T12:00",
  },
} satisfies Meta<typeof DateTimeLocalField>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <DateTimeLocalField label="Default" />
      <DateTimeLocalField label="Disabled" disabled defaultValue="2026-03-11T12:00" />
      <DateTimeLocalField label="Invalid" errorMessage="Date and time are required" />
    </div>
  ),
} satisfies Story
