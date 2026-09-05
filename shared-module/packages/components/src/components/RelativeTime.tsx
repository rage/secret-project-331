"use client"

/* oxlint-disable i18next/no-literal-string */

import { css } from "@emotion/css"
import React from "react"
import { useDateFormatter, useLocale } from "react-aria"

export interface RelativeTimeProps {
  /** ISO 8601 timestamp. Renders `RELATIVE_TIME_ABSENT_LABEL` when null/undefined. */
  at: string | null | undefined
}

export const RELATIVE_TIME_ABSENT_LABEL = "—"

/**
 * Each entry divides `duration` down to the next unit; `limit` is that divisor, not an
 * absolute threshold (so "weeks" divides by ~4.35 to reach "months", not by a week count).
 */
const relativeTimeUnits: { limit: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60, unit: "seconds" },
  { limit: 60, unit: "minutes" },
  { limit: 24, unit: "hours" },
  { limit: 7, unit: "days" },
  { limit: 4.34524, unit: "weeks" },
  { limit: 12, unit: "months" },
  { limit: Number.POSITIVE_INFINITY, unit: "years" },
]

function formatRelativeDistance(at: Date, locale: string): string {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  let duration = (at.getTime() - Date.now()) / 1000
  for (const { limit, unit } of relativeTimeUnits) {
    if (Math.abs(duration) < limit) {
      return formatter.format(Math.round(duration), unit)
    }
    duration /= limit
  }
  return formatter.format(Math.round(duration), "years")
}

const absoluteTimeCss = css`
  font-size: var(--font-size-1);
  color: var(--color-gray-500);
`

/**
 * Renders a timestamp as a locale-aware relative distance (e.g. "3 hours ago"), with the
 * absolute date and time always visible alongside it rather than hidden behind a hover tooltip.
 */
export const RelativeTime: React.FC<RelativeTimeProps> = ({ at }) => {
  const { locale } = useLocale()
  const absoluteFormatter = useDateFormatter({ dateStyle: "medium", timeStyle: "short" })

  if (!at) {
    return <span>{RELATIVE_TIME_ABSENT_LABEL}</span>
  }

  const date = new Date(at)
  const absoluteLabel = absoluteFormatter.format(date)

  return (
    <time dateTime={at}>
      {formatRelativeDistance(date, locale)}{" "}
      <span className={absoluteTimeCss}>({absoluteLabel})</span>
    </time>
  )
}
