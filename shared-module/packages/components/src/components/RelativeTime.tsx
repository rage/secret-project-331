"use client"

import { css } from "@emotion/css"
import React from "react"
import { useLocale } from "react-aria"

import { ABSENT_LABEL } from "../lib/displayConstants"
import {
  formatDuration,
  formatIsoDate,
  formatRelativeDistance,
  formatTimestamp,
  formatTimestampWithZone,
} from "../lib/utils/relativeTimeFormat"

export interface RelativeTimeProps {
  /** ISO 8601 timestamp. Renders `ABSENT_LABEL` when null/undefined. */
  at: string | null | undefined
  /**
   * Where the absolute date and time goes.
   *
   * - `inline` (the default) prints it beside the relative distance.
   * - `compact` prints it alone, without the zone suffix, short enough for a table column. Use it
   *   wherever the reader is reconciling a record rather than watching it move.
   * - `date` prints the date only, never a time — for a completion or registration date, where
   *   the time of day is noise the reader has to read past.
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

  if (!at) {
    return <span>{ABSENT_LABEL}</span>
  }

  const date = new Date(at)

  if (absoluteTime === "date") {
    return (
      <time className={nowrapCss} dateTime={at}>
        {formatIsoDate(date)}
      </time>
    )
  }

  if (absoluteTime === "compact") {
    return (
      <time className={nowrapCss} dateTime={at}>
        {formatTimestamp(date)}
      </time>
    )
  }

  const absoluteLabel = formatTimestampWithZone(date)

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
