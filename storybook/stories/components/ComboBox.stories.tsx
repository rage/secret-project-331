"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import React, { useState } from "react"

import { ComboBox } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 420px;
`

const items = [
  { id: "alpha", label: "Alpha" },
  { id: "beta", label: "Beta" },
  { id: "gamma", label: "Gamma" },
  { id: "delta", label: "Delta" },
]

const longOptionItems = [
  {
    id: "long1",
    label:
      "VeryLongOptionLabelWithoutSpacesThatShouldWrapInsideTheListboxPopoverWhenTheViewportOrTriggerIsNarrow",
  },
  { id: "long2", label: "Short" },
]

const meta = {
  title: "Components/ComboBox",
  component: ComboBox,
} satisfies Meta<typeof ComboBox>

export default meta

type Story = StoryObj<typeof meta>

function ControlledComboBoxStory() {
  const [selectedKey, setSelectedKey] = useState<React.Key | null>("beta")

  return (
    <ComboBox
      label="Controlled"
      items={items}
      selectedKey={selectedKey}
      onSelectionChange={setSelectedKey}
    >
      {(item) => item.label}
    </ComboBox>
  )
}

export const Playground = {
  render: () => (
    <ComboBox label="Project" items={items}>
      {(item) => item.label}
    </ComboBox>
  ),
} satisfies Story

export const States = {
  render: () => (
    <div className={stackCss}>
      <ComboBox label="Default" items={items}>
        {(item) => item.label}
      </ComboBox>
      <ComboBox label="Custom value" items={items} allowsCustomValue>
        {(item) => item.label}
      </ComboBox>
      <ComboBox label="Invalid" items={items} errorMessage="Selection required">
        {(item) => item.label}
      </ComboBox>
    </div>
  ),
} satisfies Story

export const Controlled = {
  render: () => <ControlledComboBoxStory />,
} satisfies Story

export const LongOptions = {
  render: () => (
    <div className={stackCss}>
      <ComboBox label="Project" items={longOptionItems}>
        {(item) => item.label}
      </ComboBox>
    </div>
  ),
} satisfies Story
