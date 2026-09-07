"use client"

import type { Control, FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Select } from "@/shared-module/components"

import { HOUR_SECS } from "./adminCreditRegistrationHooks"

export const DAY_SECS = 86_400
export const WEEK_SECS = 604_800
export const MONTH_SECS = 2_592_000

interface WindowFields extends FieldValues {
  window_secs: string
}

interface WindowSecsSelectProps<T extends WindowFields> {
  control: Control<T>
  /** api-log and errors share hour/day/week; errors adds a month option. */
  includeMonth?: boolean
}

/** The time-window picker duplicated across the api-log and errors tabs. */
export function WindowSecsSelect<T extends WindowFields>({
  control,
  includeMonth = false,
}: WindowSecsSelectProps<T>) {
  const { t } = useTranslation()
  return (
    <Select
      name={"window_secs" as Path<T>}
      control={control}
      label={t("credit-registration-admin-window")}
      options={[
        { value: String(HOUR_SECS), label: t("credit-registration-admin-window-hour") },
        { value: String(DAY_SECS), label: t("credit-registration-admin-window-day") },
        { value: String(WEEK_SECS), label: t("credit-registration-admin-window-week") },
        ...(includeMonth
          ? [{ value: String(MONTH_SECS), label: t("credit-registration-admin-window-month") }]
          : []),
      ]}
    />
  )
}
