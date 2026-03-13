"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { AlignLeft } from "@vectopus/atlas-icons-react"

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

const meta = {
  title: "Components/TextArea",
  component: TextArea,
  parameters: {
    docs: {
      description: {
        component:
          'Floating-label textarea built on React Aria `useTextField` with `inputElementType="textarea"`, including size variants, description/error messaging, icons, and optional auto-resize.',
      },
    },
  },
  argTypes: {
    fieldSize: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    autoResize: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof TextArea>

export default meta

type StoryType = StoryObj<typeof meta>

export const Playground = {
  args: {
    label: "Bio",
    fieldSize: "md",
    rows: 3,
    description: "Tell us a little bit about yourself.",
    autoResize: true,
  },
} satisfies StoryType

export const States = {
  render: () => (
    <div className={columnCss}>
      <TextArea label="Default" rows={3} />
      <TextArea label="With description" description="Helper text goes here." rows={3} />
      <TextArea label="With error" errorMessage="Too short." rows={3} />
      <TextArea label="Disabled" disabled rows={3} />
      <TextArea label="Read only" defaultValue="Read-only content" readOnly rows={3} />
      <TextArea label="Plain editor" appearance="plain" rows={3} defaultValue="Inline editable text" />
    </div>
  ),
} satisfies StoryType

export const Sizes = {
  render: () => (
    <div className={rowCss}>
      <TextArea label="Small" fieldSize="sm" rows={3} />
      <TextArea label="Medium" fieldSize="md" rows={3} />
      <TextArea label="Large" fieldSize="lg" rows={3} />
    </div>
  ),
} satisfies StoryType

export const WithIcon = {
  render: () => (
    <div className={columnCss}>
      <TextArea
        label="Notes"
        description="Leading icon anchored to the label baseline."
        iconStart={<AlignLeft aria-hidden="true" size={16} />}
        rows={4}
      />
    </div>
  ),
} satisfies StoryType

export const AutoResize = {
  render: () => (
    <div className={columnCss}>
      <TextArea
        label="Auto-resize"
        autoResize
        autoResizeMaxHeightPx={160}
        defaultValue={
          "This textarea auto-resizes to fit its content.\n\nResize by typing more lines and watch it clamp at a maximum height with a scrollbar."
        }
      />
    </div>
  ),
} satisfies StoryType
