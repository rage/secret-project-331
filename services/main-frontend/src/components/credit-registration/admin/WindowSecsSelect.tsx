"use client"

import { useEffect } from "react"
import type { Control, FieldValues, Path } from "react-hook-form"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Select } from "@/shared-module/components"

import { HOUR_SECS } from "./adminCreditRegistrationHooks"
import { useQueryParamFilters } from "./useQueryParamFilters"

export const DAY_SECS = 86_400
export const WEEK_SECS = 604_800
export const MONTH_SECS = 2_592_000

// oxlint-disable-next-line i18next/no-literal-string
const PARAM_WINDOW_SECS = "window_secs"

interface WindowFields extends FieldValues {
  window_secs: string
}

interface WindowSecsSelectProps<T extends WindowFields> {
  control: Control<T>
  /** The System tab shares hour/day/week; Errors adds a month option. */
  includeMonth?: boolean
}

/** The time-window picker shared by the System and Errors tabs. */
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

export interface WindowSecsParam {
  control: Control<{ window_secs: string }>
  windowSecs: number
}

/**
 * The window picker's value, kept in the query string so a pasted link opens on the same window.
 * Pair the returned `control` with `WindowSecsSelect`.
 */
export function useWindowSecsParam(defaultSecs: number): WindowSecsParam {
  const { param, applyParams } = useQueryParamFilters()
  const urlValue = param(PARAM_WINDOW_SECS) ?? String(defaultSecs)
  const { control, watch, setValue } = useForm<{ window_secs: string }>({
    defaultValues: { window_secs: urlValue },
  })
  const fieldValue = watch("window_secs")

  // The URL is the source of truth, so Back and a shared link both move the field.
  useEffect(() => {
    setValue("window_secs", urlValue)
  }, [urlValue, setValue])

  // And a changed field pushes back into the URL. Comparing first is what stops the two effects
  // from bouncing off each other.
  useEffect(() => {
    if (fieldValue !== urlValue) {
      applyParams({
        [PARAM_WINDOW_SECS]: fieldValue === String(defaultSecs) ? undefined : fieldValue,
      })
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldValue])

  return { control, windowSecs: Number(urlValue) }
}
