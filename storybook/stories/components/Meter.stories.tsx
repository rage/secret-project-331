"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Meter } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 20px;
  max-width: 360px;
`

const meta = {
  title: "Components/Meter",
  component: Meter,
  args: {
    label: "Completed",
    value: 5040,
    maxValue: 10800,
    threshold: 10800,
    valueLabel: "1.4 h of 3 h (47%)",
    tone: "warning",
  },
} satisfies Meta<typeof Meter>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const DurationVsThreshold = {
  render: () => (
    <div className={stackCss}>
      <Meter
        label="Intro to Programming"
        value={5040}
        maxValue={10800}
        threshold={10800}
        valueLabel="1.4 h of 3 h (47%)"
        tone="warning"
      />
      <Meter
        label="Data Structures"
        value={3240}
        maxValue={10800}
        threshold={10800}
        valueLabel="0.9 h of 3 h (30%)"
        tone="neutral"
      />
    </div>
  ),
} satisfies Story

export const CompactGapBars = {
  render: () => (
    <div className={stackCss}>
      <Meter label="Module 1 gap" value={720} maxValue={3000} tone="neutral" showLabel={false} />
      <Meter label="Module 3 gap" value={3000} maxValue={3000} tone="neutral" showLabel={false} />
      <Meter label="Module 4 gap" value={120} maxValue={3000} tone="warning" showLabel={false} />
    </div>
  ),
} satisfies Story
