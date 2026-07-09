"use client"

import type { Meta, StoryObj } from "@storybook/react-vite"

import { DescriptionList } from "../../src/shared-module/components"

const meta = {
  title: "Components/DescriptionList",
  component: DescriptionList,
  args: {
    layout: "inline",
    items: [
      { label: "Email", value: "user@example.fi" },
      { label: "Account created", value: "2019-09-01" },
      { label: "TMC id", value: "4821" },
    ],
  },
} satisfies Meta<typeof DescriptionList>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const Stacked = {
  args: { layout: "stacked" },
} satisfies Story
