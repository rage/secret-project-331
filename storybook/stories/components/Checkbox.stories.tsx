"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"

import { Checkbox } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
`

interface CheckboxDemoProps {
  label: ReactNode
  defaultChecked?: boolean
  isIndeterminate?: boolean
  isDisabled?: boolean
  errorMessage?: ReactNode
}

/** Wires a standalone react-hook-form field so the checkbox can be storied on its own. */
function CheckboxDemo({ defaultChecked = false, ...props }: CheckboxDemoProps) {
  const { control } = useForm<{ accepted: boolean }>({
    defaultValues: { accepted: defaultChecked },
  })
  return <Checkbox name="accepted" control={control} {...props} />
}

const meta = {
  title: "Components/Checkbox",
  component: CheckboxDemo,
  args: {
    label: "Accept terms",
  },
} satisfies Meta<typeof CheckboxDemo>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <CheckboxDemo label="Default" />
      <CheckboxDemo label="Checked" defaultChecked />
      <CheckboxDemo label="Indeterminate" isIndeterminate />
      <CheckboxDemo label="Disabled" isDisabled />
      <CheckboxDemo label="Invalid" errorMessage="Required" />
    </div>
  ),
} satisfies Story
