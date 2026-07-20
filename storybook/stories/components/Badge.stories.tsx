"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Badge } from "../../src/shared-module/components"

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

const meta = {
  title: "Components/Badge",
  component: Badge,
  args: {
    tone: "neutral",
    children: "Badge",
  },
} satisfies Meta<typeof Badge>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const Tones = {
  render: () => (
    <div className={rowCss}>
      <Badge tone="neutral">Dismissed</Badge>
      <Badge tone="info">Current</Badge>
      <Badge tone="success">Passed</Badge>
      <Badge tone="warning">Flagged</Badge>
      <Badge tone="danger">Confirmed cheating</Badge>
    </div>
  ),
} satisfies Story
