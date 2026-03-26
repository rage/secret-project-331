"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { FileField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 420px;
`

const meta = {
  title: "Components/FileField",
  component: FileField,
  args: {
    label: "Upload files",
    buttonLabel: "Browse",
  },
} satisfies Meta<typeof FileField>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <FileField label="Single file" />
      <FileField label="Multiple files" multiple />
      <FileField label="Disabled" disabled />
      <FileField label="Invalid" errorMessage="A file is required" />
    </div>
  ),
} satisfies Story
