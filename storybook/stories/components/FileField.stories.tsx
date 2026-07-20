"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"

import { FileField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 420px;
`

interface FileFieldDemoProps {
  label: ReactNode
  buttonLabel?: ReactNode
  multiple?: boolean
  isDisabled?: boolean
  errorMessage?: ReactNode
}

/** Wires a standalone react-hook-form field so the file field can be storied on its own. */
function FileFieldDemo(props: FileFieldDemoProps) {
  const { control } = useForm<{ files: File[] | null }>({
    defaultValues: { files: null },
  })
  return <FileField name="files" control={control} {...props} />
}

const meta = {
  title: "Components/FileField",
  component: FileFieldDemo,
  args: {
    label: "Upload files",
    buttonLabel: "Browse",
  },
} satisfies Meta<typeof FileFieldDemo>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <FileFieldDemo label="Single file" />
      <FileFieldDemo label="Multiple files" multiple />
      <FileFieldDemo label="Disabled" isDisabled />
      <FileFieldDemo label="Invalid" errorMessage="A file is required" />
    </div>
  ),
} satisfies Story
