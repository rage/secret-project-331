"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { CopyButton } from "../../src/shared-module/components"

const rowCss = css`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: monospace;
`

const meta = {
  title: "Components/CopyButton",
  component: CopyButton,
  args: {
    value: "a1b2c3d4-97ca-49d9-9298-2e6aeb1e20cb",
    label: "Copy user ID",
  },
} satisfies Meta<typeof CopyButton>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const NextToValue = {
  render: (args) => (
    <span className={rowCss}>
      a1b2c3d4…
      <CopyButton {...args} />
    </span>
  ),
} satisfies Story
