"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useForm } from "react-hook-form"

import { DateField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 320px;
`

type Form = { d: string }

function PlaygroundInner() {
  const { control } = useForm<Form>({ defaultValues: { d: "2026-03-11" } })
  return <DateField name="d" control={control} label="Publish date" />
}

function StatesInner() {
  const { control } = useForm<Form>({ defaultValues: { d: "2026-03-11" } })
  const { control: c2 } = useForm<Form>({ defaultValues: { d: "2026-03-11" } })
  const { control: c3 } = useForm<Form>({ defaultValues: { d: "" } })
  return (
    <div className={stackCss}>
      <DateField name="d" control={control} label="Default" />
      <DateField name="d" control={c2} label="Disabled" isDisabled />
      <DateField name="d" control={c3} label="Invalid" errorMessage="Date is required" />
    </div>
  )
}

const meta = {
  title: "Components/DateField",
  component: DateField,
} satisfies Meta<typeof DateField>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {
  render: () => <PlaygroundInner />,
} satisfies Story

export const States = {
  render: () => <StatesInner />,
} satisfies Story
