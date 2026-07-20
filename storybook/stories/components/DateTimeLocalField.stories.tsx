"use client"

import { css } from "@emotion/css"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { DateTimeLocalField } from "../../src/shared-module/components"

const stackCss = css`
  display: grid;
  gap: 16px;
  max-width: 360px;
`

interface DateTimeLocalFieldDemoProps {
  label: ReactNode
  isDisabled?: boolean
  errorMessage?: ReactNode
  defaultValue?: string
}

/** Wires a standalone react-hook-form field so the date-time field can be storied on its own. */
function DateTimeLocalFieldDemo({
  defaultValue = "2026-03-11T12:00",
  ...props
}: DateTimeLocalFieldDemoProps) {
  const { control } = useForm<{ dt: string }>({ defaultValues: { dt: defaultValue } })
  return <DateTimeLocalField name="dt" control={control} {...props} />
}

const meta = {
  title: "Components/DateTimeLocalField",
  component: DateTimeLocalFieldDemo,
  args: {
    label: "Publish at",
  },
} satisfies Meta<typeof DateTimeLocalFieldDemo>

export default meta

type Story = StoryObj<typeof meta>

export const Playground = {
  render: () => {
    const { t } = useTranslation()
    return <DateTimeLocalFieldDemo label={t("story.dateTime.playgroundLabel")} />
  },
} satisfies Story

export const States = {
  render: () => {
    const { t } = useTranslation()
    return (
      <div className={stackCss}>
        <DateTimeLocalFieldDemo label={t("story.dateTime.default")} defaultValue="" />
        <DateTimeLocalFieldDemo label={t("story.dateTime.disabled")} isDisabled />
        <DateTimeLocalFieldDemo
          label={t("story.dateTime.invalid")}
          defaultValue=""
          errorMessage={t("story.dateTime.invalidMessage")}
        />
      </div>
    )
  },
} satisfies Story
