"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react"

import { Button } from "../../src/shared-module/components"

const stackCss = css`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`

const sizesCss = css`
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
`

const meta = {
  title: "Components/Button",
  component: Button,
  parameters: {
    docs: {
      description: {
        component:
          "Accessible button component built on React Aria with size/variant styling, icon slots, and loading state.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "tertiary"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof Button>

export default meta

type StoryType = StoryObj<typeof meta>

export const Playground = {
  args: {
    variant: "primary",
    size: "md",
    children: "Button",
  },
} satisfies StoryType

export const Variants = {
  render: () => (
    <div className={stackCss}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="tertiary">Tertiary</Button>
    </div>
  ),
} satisfies StoryType

export const Sizes = {
  render: () => (
    <div className={sizesCss}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
} satisfies StoryType

export const Loading = {
  render: () => (
    <div className={stackCss}>
      <Button isLoading loadingLabel="Loading">
        Saving
      </Button>
      <Button variant="secondary" isLoading loadingLabel="Loading">
        Syncing
      </Button>
    </div>
  ),
} satisfies StoryType

export const WithIcons = {
  render: () => (
    <div className={stackCss}>
      <Button icon={<span aria-hidden="true">★</span>} iconPosition="start">
        Starred
      </Button>
      <Button icon={<span aria-hidden="true">→</span>} iconPosition="end">
        Continue
      </Button>
    </div>
  ),
} satisfies StoryType

export const Disabled = {
  render: () => (
    <div className={stackCss}>
      <Button disabled>Disabled</Button>
      <Button variant="secondary" disabled>
        Disabled
      </Button>
      <Button variant="tertiary" disabled>
        Disabled
      </Button>
    </div>
  ),
} satisfies StoryType
