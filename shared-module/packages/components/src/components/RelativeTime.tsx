"use client"

/* oxlint-disable i18next/no-literal-string */

import { css } from "@emotion/css"
import React from "react"
import { useDateFormatter, useLocale } from "react-aria"

import { ABSENT_LABEL } from "../lib/displayConstants"

export interface RelativeTimeProps {
  /** ISO 8601 timestamp. Renders `ABSENT_LABEL` when null/undefined. */
  at: string | null | undefined
  /**
   * Where the absolute date and time goes. "inline" (the default) prints it beside the relative
   * distance; "title" moves it into the element's tooltip, for tables carrying several time columns
   * where an inline date on every row crowds out the values being compared.
   */
  absoluteTime?: "inline" | "title"
}

/**
 * Each entry divides `duration` down to the next unit; `limit` is that divisor, not an
 * absolute threshold (so "weeks" divides by ~4.35 to reach "months", not by a week count).
 * Years is the fallback below, so it needs no row.
 */
const relativeTimeUnits: { limit: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60, unit: "seconds" },
  { limit: 60, unit: "minutes" },
  { limit: 24, unit: "hours" },
  { limit: 7, unit: "days" },
  { limit: 4.34524, unit: "weeks" },
  { limit: 12, unit: "months" },
]

// Resolving a locale costs more than the format call; tables render one instance per row.
const formatterCache = new Map<string, Intl.RelativeTimeFormat>()

function relativeTimeFormatter(locale: string): Intl.RelativeTimeFormat {
  const cached = formatterCache.get(locale)
  if (cached) {
    return cached
  }
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  formatterCache.set(locale, formatter)
  return formatter
}

function formatRelativeDistance(at: Date, locale: string): string {
  const formatter = relativeTimeFormatter(locale)
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
 * absolute date and time beside it rather than hidden behind a hover tooltip. Pass
 * `absoluteTime="title"` where an inline date would crowd the surrounding values.
 */
export const RelativeTime: React.FC<RelativeTimeProps> = ({ at, absoluteTime = "inline" }) => {
  const { locale } = useLocale()
  const absoluteFormatter = useDateFormatter({ dateStyle: "medium", timeStyle: "short" })

  if (!at) {
    return <span>{ABSENT_LABEL}</span>
  }

  const date = new Date(at)
  const absoluteLabel = absoluteFormatter.format(date)

  if (absoluteTime === "title") {
    return (
      <time dateTime={at} title={absoluteLabel}>
        {formatRelativeDistance(date, locale)}
      </time>
    )
  }

  return (
    <time dateTime={at}>
      {formatRelativeDistance(date, locale)}{" "}
      <span className={absoluteTimeCss}>({absoluteLabel})</span>
    </time>
  )
}
