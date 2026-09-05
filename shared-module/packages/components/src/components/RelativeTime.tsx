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
   * Where the absolute date and time goes.
   *
   * - `inline` (the default) prints it beside the relative distance.
   * - `compact` prints it alone, short enough for a table column: day and month plus the time
   *   within the current year, day, month and year before that. Use it wherever the reader is
   *   reconciling a record rather than watching it move.
   * - `date` prints day, month and year only, never a time — for a completion or registration
   *   date, where the time of day is noise the reader has to read past.
   * - `duration` prints the elapsed span instead of a point in time, e.g. "26 d" or "3 h 12 min"
   *   — for a value the reader is comparing against a threshold or watching move, where an
   *   absolute timestamp would make them do the subtraction by hand. The full date sits in
   *   `title` as a secondary lookup, not the primary reading.
   * - `title` moves it into the element's tooltip. **A tooltip does not exist on a touch device
   *   and does not survive a screenshot**, so this leaves the reader with the relative phrase
   *   alone: only for a table that already gives the date somewhere else.
   */
  absoluteTime?: "inline" | "compact" | "date" | "duration" | "title"
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

type DurationUnit = "day" | "hour" | "minute" | "second"

// `Intl.NumberFormat`'s narrow unit style joins number and abbreviation with no space (e.g.
// "26d"); formatToParts lets us keep the locale's own abbreviation while inserting one.
function formatUnitNarrow(value: number, unit: DurationUnit, locale: string): string {
  const parts = new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "narrow",
  }).formatToParts(value)
  const numeral = parts
    .filter((part) => part.type !== "unit")
    .map((part) => part.value)
    .join("")
  const unitText = parts.find((part) => part.type === "unit")?.value ?? ""
  return `${numeral} ${unitText}`
}

/**
 * The elapsed span between `at` and now, as its one or two largest units (e.g. "26 d",
 * "3 h 12 min"). Always positive: a duration, not a point in time, so it reads the same whether
 * `at` is in the past or the future.
 */
function formatDuration(at: Date, locale: string): string {
  const totalSeconds = Math.round(Math.abs(Date.now() - at.getTime()) / 1000)

  const days = Math.floor(totalSeconds / 86400)
  if (days >= 1) {
    return formatUnitNarrow(days, "day", locale)
  }

  const hours = Math.floor(totalSeconds / 3600)
  if (hours >= 1) {
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return minutes > 0
      ? `${formatUnitNarrow(hours, "hour", locale)} ${formatUnitNarrow(minutes, "minute", locale)}`
      : formatUnitNarrow(hours, "hour", locale)
  }

  const minutes = Math.floor(totalSeconds / 60)
  if (minutes >= 1) {
    return formatUnitNarrow(minutes, "minute", locale)
  }

  return formatUnitNarrow(totalSeconds, "second", locale)
}

// "13 minutes ago" wrapping to "13 minutes / ago" in a narrow column costs a row its height, so
// each part holds together and the line breaks between them instead.
const nowrapCss = css`
  white-space: nowrap;
`

const absoluteTimeCss = css`
  white-space: nowrap;
  font-size: var(--font-size-1);
  color: var(--color-gray-500);
`

/**
 * Renders a timestamp as a locale-aware relative distance (e.g. "3 hours ago"), with the
 * absolute date and time beside it rather than hidden behind a hover tooltip. Pass
 * `absoluteTime="compact"` in tables and records, where the date is the point and the distance is
 * not.
 */
export const RelativeTime: React.FC<RelativeTimeProps> = ({ at, absoluteTime = "inline" }) => {
  const { locale } = useLocale()
  const absoluteFormatter = useDateFormatter({ dateStyle: "medium", timeStyle: "short" })
  const compactThisYearFormatter = useDateFormatter({
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
  // Also the "compact" branch's fallback for a year other than the current one.
  const dateFormatter = useDateFormatter({ day: "numeric", month: "short", year: "numeric" })

  if (!at) {
    return <span>{ABSENT_LABEL}</span>
  }

  const date = new Date(at)

  if (absoluteTime === "date") {
    return (
      <time className={nowrapCss} dateTime={at}>
        {dateFormatter.format(date)}
      </time>
    )
  }

  if (absoluteTime === "compact") {
    const isThisYear = date.getFullYear() === new Date().getFullYear()
    const formatter = isThisYear ? compactThisYearFormatter : dateFormatter
    return (
      <time className={nowrapCss} dateTime={at}>
        {formatter.format(date)}
      </time>
    )
  }

  const absoluteLabel = absoluteFormatter.format(date)

  if (absoluteTime === "duration") {
    return (
      <time className={nowrapCss} dateTime={at} title={absoluteLabel}>
        {formatDuration(date, locale)}
      </time>
    )
  }

  if (absoluteTime === "title") {
    return (
      <time className={nowrapCss} dateTime={at} title={absoluteLabel}>
        {formatRelativeDistance(date, locale)}
      </time>
    )
  }

  return (
    <time dateTime={at}>
      <span className={nowrapCss}>{formatRelativeDistance(date, locale)}</span>{" "}
      <span className={absoluteTimeCss}>({absoluteLabel})</span>
    </time>
  )
}
