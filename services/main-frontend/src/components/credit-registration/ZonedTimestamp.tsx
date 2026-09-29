"use client"

import { css } from "@emotion/css"

import { ABSENT } from "@/components/credit-registration/constants"
import { timeZoneOffsetString } from "@/shared-module/common/utils/time"
import { formatTimestamp } from "@/shared-module/components/lib/utils/relativeTimeFormat"

// `formatTimestamp` is `YYYY-MM-DD HH:MM:SS`.
const DATE_LENGTH = 10
const TIME_START = 11

const nowrapCss = css`
  white-space: nowrap;
`

/** `2026-09-29 13:43:37 (UTC+3)`: an absolute timestamp with its zone spelled out. */
export function formatZonedTimestamp(at: Date): string {
  return `${formatTimestamp(at)} (${timeZoneOffsetString(at)})`
}

/** `13:05:12–13:43:37 (UTC+3)`; full timestamps when the range spans days. */
export function formatZonedTimeRange(from: Date, to: Date): string {
  const start = formatTimestamp(from)
  const end = formatTimestamp(to)
  if (start.slice(0, DATE_LENGTH) !== end.slice(0, DATE_LENGTH)) {
    return `${formatZonedTimestamp(from)}–${formatZonedTimestamp(to)}`
  }
  return `${start.slice(TIME_START)}–${end.slice(TIME_START)} (${timeZoneOffsetString(to)})`
}

/** A `<time>` showing an absolute timestamp with its zone; `ABSENT` when there is none. */
export const ZonedTimestamp: React.FC<{ at: string | null | undefined }> = ({ at }) => {
  if (!at) {
    return <span>{ABSENT}</span>
  }
  return (
    <time className={nowrapCss} dateTime={at}>
      {formatZonedTimestamp(new Date(at))}
    </time>
  )
}
