"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"

import { DateField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 320px;
`

interface DateFieldDemoProps {
  label: ReactNode
  isDisabled?: boolean
  errorMessage?: ReactNode
  defaultValue?: string
}

/** Wires a standalone react-hook-form field so the date field can be storied on its own. */
function DateFieldDemo({ defaultValue = "2026-03-11", ...props }: DateFieldDemoProps) {
  const { control } = useForm<{ d: string }>({ defaultValues: { d: defaultValue } })
  return <DateField name="d" control={control} {...props} />
}

const meta = {
  title: "Components/DateField",
  component: DateFieldDemo,
  args: {
    label: "Publish date",
  },
} satisfies Meta<typeof DateFieldDemo>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <DateFieldDemo label="Default" />
      <DateFieldDemo label="Disabled" isDisabled />
      <DateFieldDemo label="Invalid" defaultValue="" errorMessage="Date is required" />
    </div>
  ),
} satisfies Story
