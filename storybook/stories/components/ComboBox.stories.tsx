"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"

import { ComboBox } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 420px;
`

interface Item {
  id: string
  label: string
}

const items: Item[] = [
  { id: "alpha", label: "Alpha" },
  { id: "beta", label: "Beta" },
  { id: "gamma", label: "Gamma" },
  { id: "delta", label: "Delta" },
]

const longOptionItems: Item[] = [
  {
    id: "long1",
    label:
      "VeryLongOptionLabelWithoutSpacesThatShouldWrapInsideTheListboxPopoverWhenTheViewportOrTriggerIsNarrow",
  },
  { id: "long2", label: "Short" },
]

interface ComboBoxDemoProps {
  label: ReactNode
  items: Item[]
  allowsCustomValue?: boolean
  errorMessage?: ReactNode
  defaultSelectedKey?: string | null
}

/** Wires a standalone react-hook-form field so the combobox can be storied on its own. */
function ComboBoxDemo({ defaultSelectedKey = null, items: data, ...rest }: ComboBoxDemoProps) {
  const { control } = useForm<{ value: string | null }>({
    defaultValues: { value: defaultSelectedKey },
  })
  return (
    <ComboBox
      name="value"
      control={control}
      getItemKey={(item) => item.id}
      getItemTextValue={(item) => item.label}
      items={data}
      {...rest}
    >
      {(item) => item.label}
    </ComboBox>
  )
}

const meta = {
  title: "Components/ComboBox",
  component: ComboBoxDemo,
  args: {
    label: "Project",
    items,
  },
} satisfies Meta<typeof ComboBoxDemo>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <ComboBoxDemo label="Default" items={items} />
      <ComboBoxDemo label="Custom value" items={items} allowsCustomValue />
      <ComboBoxDemo label="Invalid" items={items} errorMessage="Selection required" />
    </div>
  ),
} satisfies Story

export const Controlled = {
  render: () => <ComboBoxDemo label="Controlled" items={items} defaultSelectedKey="beta" />,
} satisfies Story

export const LongOptions = {
  render: () => (
    <div className={stackCss}>
      <ComboBoxDemo label="Project" items={longOptionItems} />
    </div>
  ),
} satisfies Story
