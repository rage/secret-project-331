"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { TimeField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 320px;
`

interface Form {
  t: string
}

function PlaygroundStory() {
  const { t } = useTranslation()
  const { control } = useForm<Form>({ defaultValues: { t: "09:30" } })
  return <TimeField name="t" control={control} label={t("story.time.playgroundLabel")} />
}

function StatesStory() {
  const { t } = useTranslation()
  const { control } = useForm<Form>({ defaultValues: { t: "" } })
  const { control: c2 } = useForm<Form>({ defaultValues: { t: "09:30" } })
  const { control: c3 } = useForm<Form>({ defaultValues: { t: "" } })
  return (
    <div className={stackCss}>
      <TimeField name="t" control={control} label={t("story.time.default")} />
      <TimeField name="t" control={c2} label={t("story.time.disabled")} isDisabled />
      <TimeField
        name="t"
        control={c3}
        label={t("story.time.invalid")}
        errorMessage={t("story.time.invalidMessage")}
      />
    </div>
  )
}

const meta = {
  title: "Components/TimeField",
  component: TimeField,
  render: () => <PlaygroundStory />,
} satisfies Meta<typeof TimeField>

export default meta

type Story = StoryObj<typeof TimeField>

export const Playground = {} satisfies Story

export const States = {
  render: () => <StatesStory />,
} satisfies Story
