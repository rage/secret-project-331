"use client"

import type { Meta, StoryObj } from "@storybook/react-vite"

import { StatTile, StatTileList } from "../../src/shared-module/components"

const meta = {
  title: "Components/StatTile",
  component: StatTile,
  args: {
    label: "Enrolled courses",
    value: 7,
  },
} satisfies Meta<typeof StatTile>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const Row = {
  render: () => (
    <StatTileList ariaLabel="Study overview">
      <StatTile label="Enrolled courses" value={7} ariaLabel="Enrolled courses: 7" />
      <StatTile label="Currently active" value={2} ariaLabel="Currently active: 2" />
      <StatTile label="Completions" value={11} ariaLabel="Completions: 11" />
      <StatTile
        label="Awaiting review"
        value={3}
        alertWhenNonZero
        ariaLabel="Awaiting review: 3"
        href="#completion-review"
      />
    </StatTileList>
  ),
} satisfies Story
