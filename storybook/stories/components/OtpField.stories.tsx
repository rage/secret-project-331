"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useForm } from "react-hook-form"

import { OtpField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 420px;
`

interface Form {
  code: string
}

function PlaygroundStory() {
  const { control } = useForm<Form>({ defaultValues: { code: "123" } })

  return <OtpField name="code" control={control} label="Verification code" length={6} />
}

function StatesStory() {
  const { control } = useForm<Form>({ defaultValues: { code: "" } })
  const { control: invalidControl } = useForm<Form>({ defaultValues: { code: "" } })
  const { control: disabledControl } = useForm<Form>({ defaultValues: { code: "123456" } })

  return (
    <div className={stackCss}>
      <OtpField name="code" control={control} label="Default" />
      <OtpField
        name="code"
        control={invalidControl}
        label="Invalid"
        errorMessage="Code is required"
      />
      <OtpField name="code" control={disabledControl} label="Disabled" isDisabled />
    </div>
  )
}

function ControlledOtpFieldStory() {
  const { control } = useForm<Form>({ defaultValues: { code: "123" } })

  return <OtpField name="code" control={control} label="Controlled" />
}

const meta = {
  title: "Components/OtpField",
  component: OtpField,
} satisfies Meta<typeof OtpField>

export default meta

type Story = StoryObj<typeof OtpField>

export const Playground = {
  render: () => <PlaygroundStory />,
} satisfies Story

export const States = {
  render: () => <StatesStory />,
} satisfies Story

export const Controlled = {
  render: () => <ControlledOtpFieldStory />,
} satisfies Story
