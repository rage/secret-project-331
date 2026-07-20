"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ArrowRight, Mail } from "@vectopus/atlas-icons-react"
import { useForm } from "react-hook-form"

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

type StoryType = StoryObj<typeof TextField>

export const Playground = {
  render: () => {
    const { control } = useForm<{ email: string }>({ defaultValues: { email: "" } })
    return (
      <TextField
        name="email"
        control={control}
        label="Email"
        type="email"
        fieldSize="md"
        description="We'll only use this for account updates."
        placeholder="ignored in floating-label mode"
        isRequired
      />
    )
  },
} satisfies StoryType

export const States = {
  render: () => {
    const { control } = useForm({
      defaultValues: {
        default: "",
        description: "",
        error: "",
        disabled: "",
        readonly: "Read-only value",
      },
    })
    return (
      <div className={columnCss}>
        <TextField name="default" control={control} label="Default" />
        <TextField
          name="description"
          control={control}
          label="With description"
          description="Helper text goes here."
        />
        <TextField
          name="error"
          control={control}
          label="With error"
          errorMessage="This field is required."
        />
        <TextField name="disabled" control={control} label="Disabled" isDisabled />
        <TextField name="readonly" control={control} label="Read only" isReadOnly />
      </div>
    )
  },
} satisfies StoryType

export const Sizes = {
  render: () => {
    const { control } = useForm({
      defaultValues: { small: "", medium: "", large: "" },
    })
    return (
      <div className={rowCss}>
        <TextField name="small" control={control} label="Small" fieldSize="sm" />
        <TextField name="medium" control={control} label="Medium" fieldSize="md" />
        <TextField name="large" control={control} label="Large" fieldSize="lg" />
      </div>
    )
  },
} satisfies StoryType

export const WithIcons = {
  render: () => {
    const { control } = useForm({
      defaultValues: { email: "", search: "" },
    })
    return (
      <div className={columnCss}>
        <TextField
          name="email"
          control={control}
          label="Email"
          type="email"
          iconStart={<Mail aria-hidden="true" size={16} />}
          description="Leading icon with floating label."
        />
        <TextField
          name="search"
          control={control}
          label="Search"
          type="search"
          iconEnd={<ArrowRight aria-hidden="true" size={16} />}
          description="Trailing icon with floating label."
        />
      </div>
    )
  },
} satisfies StoryType

export const Prefilled = {
  render: () => {
    const { control } = useForm({
      defaultValues: { defaultValue: "Prefilled value", controlledValue: "Controlled value" },
    })
    return (
      <div className={columnCss}>
        <TextField name="defaultValue" control={control} label="Default value" />
        <TextField name="controlledValue" control={control} label="Controlled value" />
      </div>
    )
  },
} satisfies StoryType

const longUnbroken =
  "VeryLongUnbrokenLabelStringThatShouldWrapGracefullyInNarrowLayoutsWithoutOverflowingTheViewportHorizontally"

export const LongMessages = {
  render: () => {
    const { control } = useForm({
      defaultValues: { longDescription: "", longError: "" },
    })
    return (
      <div className={columnCss}>
        <TextField
          name="longDescription"
          control={control}
          label={longUnbroken}
          description="Helper text that is intentionally long so description wrapping can be reviewed at narrow widths."
        />
        <TextField
          name="longError"
          control={control}
          label="Label"
          errorMessage="Error text that is intentionally long so error wrapping can be reviewed at narrow widths without horizontal overflow."
        />
      </div>
    )
  },
} satisfies StoryType
