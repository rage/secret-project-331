"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react"

import { DateField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 320px;
`

const meta = {
  title: "Components/DateField",
  component: DateField,
  args: {
    label: "Publish date",
    defaultValue: "2026-03-11",
  },
} satisfies Meta<typeof DateField>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <DateField label="Default" />
      <DateField label="Disabled" disabled defaultValue="2026-03-11" />
      <DateField label="Invalid" errorMessage="Date is required" />
    </div>
  ),
} satisfies Story
