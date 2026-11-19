"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useForm } from "react-hook-form"

import { Radio, RadioGroup } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 24px;
`

function VerticalStory() {
  const { control } = useForm<{ theme: string }>({ defaultValues: { theme: "light" } })

  return (
    <RadioGroup name="theme" control={control} label="Theme">
      <Radio label="Light" value="light" />
      <Radio label="Dark" value="dark" />
      <Radio label="System" value="system" />
    </RadioGroup>
  )
}

function StatesStory() {
  const { control } = useForm<{ delivery: string }>({ defaultValues: { delivery: "" } })
  const { control: orientationControl } = useForm<{ orientation: string }>({
    defaultValues: { orientation: "left" },
  })

  return (
    <div className={stackCss}>
      <RadioGroup
        name="delivery"
        control={control}
        label="Delivery speed"
        errorMessage="Choose one"
      >
        <Radio label="Standard" value="standard" />
        <Radio label="Express" value="express" />
      </RadioGroup>
      <RadioGroup
        name="orientation"
        control={orientationControl}
        label="Orientation"
        orientation="horizontal"
      >
        <Radio label="Left" value="left" />
        <Radio label="Right" value="right" />
      </RadioGroup>
    </div>
  )
}

function ControlledRadioGroupStory() {
  const { control } = useForm<{ choice: string }>({ defaultValues: { choice: "alpha" } })

  return (
    <RadioGroup name="choice" control={control} label="Controlled">
      <Radio label="Alpha" value="alpha" />
      <Radio label="Beta" value="beta" />
    </RadioGroup>
  )
}

function SegmentedStory() {
  const { control } = useForm<{ student: string; need: string }>({
    defaultValues: { student: "no", need: "" },
  })

  return (
    <div className={stackCss}>
      <RadioGroup
        name="student"
        control={control}
        label="Are you a student?"
        variant="segmented"
        showCheckMark
      >
        <Radio label="Yes" value="yes" />
        <Radio label="No" value="no" />
      </RadioGroup>
      <RadioGroup
        name="need"
        control={control}
        label="Which do you need?"
        variant="segmented"
        fillWidth
        showCheckMark
      >
        <Radio label="A certificate of completion" value="certificate" />
        <Radio label="University of Helsinki credits" value="credits" />
        <Radio label="Neither" value="neither" />
      </RadioGroup>
    </div>
  )
}

const meta = {
  title: "Components/RadioGroup",
  component: RadioGroup,
} satisfies Meta<typeof RadioGroup>

export default meta

type Story = StoryObj<typeof RadioGroup>

export const Vertical = {
  render: () => <VerticalStory />,
} satisfies Story

export const States = {
  render: () => <StatesStory />,
} satisfies Story

export const Controlled = {
  render: () => <ControlledRadioGroupStory />,
} satisfies Story

export const Segmented = {
  render: () => <SegmentedStory />,
} satisfies Story
