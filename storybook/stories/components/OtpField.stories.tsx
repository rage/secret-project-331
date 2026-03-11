"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"

import { OtpField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 420px;
`

const meta = {
  title: "Components/OtpField",
  component: OtpField,
  args: {
    label: "Verification code",
    length: 6,
  },
} satisfies Meta<typeof OtpField>

export default meta

type Story = StoryObj<typeof meta>

function ControlledOtpFieldStory() {
  const [value, setValue] = useState("123")

  return (
    <OtpField
      label="Controlled"
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  )
}

export const Playground = {} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <OtpField label="Default" />
      <OtpField label="Invalid" errorMessage="Code is required" />
      <OtpField label="Disabled" disabled defaultValue="123456" />
    </div>
  ),
} satisfies Story

export const Controlled = {
  render: () => <ControlledOtpFieldStory />,
} satisfies Story
