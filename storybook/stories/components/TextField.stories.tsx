"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ArrowRight, Mail } from "@vectopus/atlas-icons-react"

import { TextField } from "../../src/shared-module/components"

const columnCss = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 360px;
`

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
`

const meta = {
  title: "Components/TextField",
  component: TextField,
  parameters: {
    docs: {
      description: {
        component:
          "Floating-label text field built on React Aria `useTextField`, with size variants, description/error messaging, and optional start/end icons.",
      },
    },
  },
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password"],
    },
    fieldSize: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof TextField>

export default meta

type StoryType = StoryObj<typeof meta>

export const Playground = {
  args: {
    label: "Email",
    type: "email",
    fieldSize: "md",
    description: "We’ll only use this for account updates.",
    placeholder: "ignored in floating-label mode",
    required: true,
  },
} satisfies StoryType

export const States = {
  render: () => (
    <div className={columnCss}>
      <TextField label="Default" />
      <TextField label="With description" description="Helper text goes here." />
      <TextField label="With error" errorMessage="This field is required." />
      <TextField label="Disabled" disabled />
      <TextField label="Read only" defaultValue="Read-only value" readOnly />
    </div>
  ),
} satisfies StoryType

export const Sizes = {
  render: () => (
    <div className={rowCss}>
      <TextField label="Small" fieldSize="sm" />
      <TextField label="Medium" fieldSize="md" />
      <TextField label="Large" fieldSize="lg" />
    </div>
  ),
} satisfies StoryType

export const WithIcons = {
  render: () => (
    <div className={columnCss}>
      <TextField
        label="Email"
        type="email"
        iconStart={<Mail aria-hidden="true" size={16} />}
        description="Leading icon with floating label."
      />
      <TextField
        label="Search"
        type="search"
        iconEnd={<ArrowRight aria-hidden="true" size={16} />}
        description="Trailing icon with floating label."
      />
    </div>
  ),
} satisfies StoryType

export const Prefilled = {
  render: () => (
    <div className={columnCss}>
      <TextField label="Default value" defaultValue="Prefilled value" />
      <TextField label="Controlled value" value="Controlled value" onChange={() => {}} />
    </div>
  ),
} satisfies StoryType

const longUnbroken =
  "VeryLongUnbrokenLabelStringThatShouldWrapGracefullyInNarrowLayoutsWithoutOverflowingTheViewportHorizontally"

export const LongMessages = {
  render: () => (
    <div className={columnCss}>
      <TextField
        label={longUnbroken}
        description="Helper text that is intentionally long so description wrapping can be reviewed at narrow widths."
      />
      <TextField
        label="Label"
        errorMessage="Error text that is intentionally long so error wrapping can be reviewed at narrow widths without horizontal overflow."
      />
    </div>
  ),
} satisfies StoryType
