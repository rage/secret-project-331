"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useTranslation } from "react-i18next"

import { DateTimeLocalField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 360px;
`

function PlaygroundStory() {
  const { t } = useTranslation()
  return (
    <DateTimeLocalField
      label={t("story.dateTime.playgroundLabel")}
      defaultValue="2026-03-11T12:00"
    />
  )
}

function StatesStory() {
  const { t } = useTranslation()
  return (
    <div className={stackCss}>
      <DateTimeLocalField label={t("story.dateTime.default")} />
      <DateTimeLocalField
        label={t("story.dateTime.disabled")}
        disabled
        defaultValue="2026-03-11T12:00"
      />
      <DateTimeLocalField
        label={t("story.dateTime.invalid")}
        errorMessage={t("story.dateTime.invalidMessage")}
      />
    </div>
  )
}

const meta = {
  title: "Components/DateTimeLocalField",
  component: DateTimeLocalField,
  render: () => <PlaygroundStory />,
} satisfies Meta<typeof DateTimeLocalField>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const States = {
  render: () => <StatesStory />,
} satisfies Story
