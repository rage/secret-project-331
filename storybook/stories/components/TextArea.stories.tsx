"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { AlignLeft } from "@vectopus/atlas-icons-react"
import { useForm } from "react-hook-form"

import { TextArea } from "../../src/shared-module/components"

const columnCss = css`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 480px;
`

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
`

type Form = { a: string; b: string; c: string }

const meta = {
  title: "Components/TextArea",
  component: TextArea,
} satisfies Meta<typeof TextArea>

export default meta

type StoryType = StoryObj<typeof meta>

export const Playground = {
  render: () => {
    const { control } = useForm<Form>({ defaultValues: { a: "" } })
    return (
      <TextArea
        name="a"
        control={control}
        label="Bio"
        fieldSize="md"
        rows={3}
        description="Tell us a little bit about yourself."
        autoResize
      />
    )
  },
} satisfies StoryType

export const States = {
  render: () => {
    const { control } = useForm<Form>({ defaultValues: { a: "", b: "", c: "Read-only content" } })
    return (
      <div className={columnCss}>
        <TextArea name="a" control={control} label="Default" rows={3} />
        <TextArea
          name="b"
          control={control}
          label="With description"
          description="Helper text goes here."
          rows={3}
        />
        <TextArea
          name="a"
          control={control}
          label="With error"
          errorMessage="Too short."
          rows={3}
        />
        <TextArea name="a" control={control} label="Disabled" isDisabled rows={3} />
        <TextArea name="c" control={control} label="Read only" isReadOnly rows={3} />
      </div>
    )
  },
} satisfies StoryType

export const Sizes = {
  render: () => {
    const { control } = useForm<Form>({ defaultValues: { a: "", b: "", c: "" } })
    return (
      <div className={rowCss}>
        <TextArea name="a" control={control} label="Small" fieldSize="sm" rows={3} />
        <TextArea name="b" control={control} label="Medium" fieldSize="md" rows={3} />
        <TextArea name="c" control={control} label="Large" fieldSize="lg" rows={3} />
      </div>
    )
  },
} satisfies StoryType

export const WithIcon = {
  render: () => {
    const { control } = useForm<Form>({ defaultValues: { a: "" } })
    return (
      <div className={columnCss}>
        <TextArea
          name="a"
          control={control}
          label="Notes"
          description="Leading icon anchored to the label baseline."
          iconStart={<AlignLeft aria-hidden="true" size={16} />}
          rows={4}
        />
      </div>
    )
  },
} satisfies StoryType
