"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { toHoursMinutes } from "../lib/durations"

export interface DurationProps {
  seconds: number
}

/** Renders a duration in seconds as localized "Xh Ym" (or "Ym" when under an hour). */
const Duration: React.FC<DurationProps> = ({ seconds }) => {
  const { t } = useTranslation()
  const { hours, minutes } = toHoursMinutes(seconds)
  return (
    <span>
      {hours > 0
        ? t("duration-hours-minutes", { hours, minutes })
        : t("duration-minutes", { minutes })}
    </span>
  )
}

export default Duration
