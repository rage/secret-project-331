"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { DateTimeLocalField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 360px;
`

interface Form {
  dt: string
}

function PlaygroundStory() {
  const { t } = useTranslation()
  const { control } = useForm<Form>({ defaultValues: { dt: "2026-03-11T12:00" } })
  return (
    <DateTimeLocalField name="dt" control={control} label={t("story.dateTime.playgroundLabel")} />
  )
}

function StatesStory() {
  const { t } = useTranslation()
  const { control } = useForm<Form>({ defaultValues: { dt: "" } })
  const { control: c2 } = useForm<Form>({ defaultValues: { dt: "2026-03-11T12:00" } })
  const { control: c3 } = useForm<Form>({ defaultValues: { dt: "" } })
  return (
    <div className={stackCss}>
      <DateTimeLocalField name="dt" control={control} label={t("story.dateTime.default")} />
      <DateTimeLocalField name="dt" control={c2} label={t("story.dateTime.disabled")} isDisabled />
      <DateTimeLocalField
        name="dt"
        control={c3}
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
