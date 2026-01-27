"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react"

import { Link } from "../../src/shared-module/components"

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
  title: "Components/Link",
  component: Link,
  parameters: {
    docs: {
      description: {
        component:
          "Accessible link component built on React Aria with optional button styling, loading state, and icon slots.",
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
} satisfies Meta<typeof Link>

export default meta

type StoryType = StoryObj<typeof meta>

export const Plain = {
  args: {
    href: "/",
    children: "Visit homepage",
  },
} satisfies StoryType

export const StyledAsButton = {
  args: {
    href: "/",
    styledAsButton: true,
    variant: "primary",
    size: "md",
    children: "Open",
  },
} satisfies StoryType

export const Variants = {
  render: () => (
    <div className={stackCss}>
      <Link href="/" styledAsButton variant="primary">
        Primary
      </Link>
      <Link href="/" styledAsButton variant="secondary">
        Secondary
      </Link>
      <Link href="/" styledAsButton variant="tertiary">
        Tertiary
      </Link>
    </div>
  ),
} satisfies StoryType

export const Sizes = {
  render: () => (
    <div className={sizesCss}>
      <Link href="/" styledAsButton size="sm">
        Small
      </Link>
      <Link href="/" styledAsButton size="md">
        Medium
      </Link>
      <Link href="/" styledAsButton size="lg">
        Large
      </Link>
    </div>
  ),
} satisfies StoryType

export const Loading = {
  render: () => (
    <div className={stackCss}>
      <Link href="/" styledAsButton isLoading loadingLabel="Loading">
        Loading
      </Link>
      <Link href="/" styledAsButton variant="secondary" isLoading loadingLabel="Loading">
        Loading
      </Link>
    </div>
  ),
} satisfies StoryType

export const Disabled = {
  render: () => (
    <div className={stackCss}>
      <Link href="/" styledAsButton isDisabled>
        Disabled
      </Link>
      <Link href="/" styledAsButton variant="secondary" isDisabled>
        Disabled
      </Link>
      <Link href="/" styledAsButton variant="tertiary" isDisabled>
        Disabled
      </Link>
    </div>
  ),
} satisfies StoryType
