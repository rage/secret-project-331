"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useTranslation } from "react-i18next"

import { TimeField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 320px;
`

function PlaygroundStory() {
  const { t } = useTranslation()
  return <TimeField label={t("story.time.playgroundLabel")} defaultValue="09:30" />
}

function StatesStory() {
  const { t } = useTranslation()
  return (
    <div className={stackCss}>
      <TimeField label={t("story.time.default")} />
      <TimeField label={t("story.time.disabled")} disabled defaultValue="09:30" />
      <TimeField label={t("story.time.invalid")} errorMessage={t("story.time.invalidMessage")} />
    </div>
  )
}

const meta = {
  title: "Components/TimeField",
  component: TimeField,
  render: () => <PlaygroundStory />,
} satisfies Meta<typeof TimeField>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {} satisfies Story

export const States = {
  render: () => <StatesStory />,
} satisfies Story
