"use client"

import { css } from "@emotion/css"
import { Trans } from "react-i18next"

import AbsentValue from "@/components/credit-registration/AbsentValue"
import type { CreditRegistrationTFunction } from "@/components/credit-registration/constants"
import { timeZoneOffsetString } from "@/shared-module/common/utils/time"
import { formatTimestamp } from "@/shared-module/components/lib/utils/relativeTimeFormat"

// `formatTimestamp` is `YYYY-MM-DD HH:MM:SS`.
const DATE_LENGTH = 10
const TIME_START = 11

// Timestamps land in translated sentences and table cells as plain strings, where a line can break
// at a space or after a hyphen; a range may still break after its dash.
const NO_BREAK_SPACE = "\u00A0"
// Not U+2011: Inter lacks it, and the fallback glyph is narrower than a hyphen.
const WORD_JOINER = "\u2060"

const unbroken = (text: string): string =>
  text.replaceAll(" ", NO_BREAK_SPACE).replaceAll("-", `-${WORD_JOINER}`)

const nowrapCss = css`
  white-space: nowrap;
`

/** `2026-09-29 13:43:37 (UTC+3)`: an absolute timestamp with its zone spelled out. */
export function formatZonedTimestamp(at: Date): string {
  return unbroken(`${formatTimestamp(at)} (${timeZoneOffsetString(at)})`)
}

const zonedTimeRangeEnds = (from: Date, to: Date): [string, string] => {
  const start = formatTimestamp(from)
  const end = formatTimestamp(to)
  const offset = timeZoneOffsetString(to)
  if (
    start.slice(0, DATE_LENGTH) !== end.slice(0, DATE_LENGTH) ||
    timeZoneOffsetString(from) !== offset
  ) {
    return [formatZonedTimestamp(from), formatZonedTimestamp(to)]
  }
  return [unbroken(start), unbroken(`${end.slice(TIME_START)} (${offset})`)]
}

/** `2026-09-29 13:05:12–13:43:37 (UTC+3)`; both full when the range spans days or a clock change. */
export function formatZonedTimeRange(from: Date, to: Date): string {
  const [start, end] = zonedTimeRangeEnds(from, to)
  return `${start}–${end}`
}

/** A `<time>` showing `formatZonedTimeRange`, which may break only after its dash. */
export const ZonedTimeRange: React.FC<{ from: string; to: string }> = ({ from, to }) => {
  const [start, end] = zonedTimeRangeEnds(new Date(from), new Date(to))
  return (
    <time dateTime={from}>
      <span className={nowrapCss}>{`${start}–`}</span>
      <wbr />
      <span className={nowrapCss}>{end}</span>
    </time>
  )
}

/** A `<time>` showing an absolute timestamp with its zone; a muted mark when there is none. */
export const ZonedTimestamp: React.FC<{ at: string | null | undefined }> = ({ at }) => {
  if (!at) {
    return <AbsentValue />
  }
  return (
    <time className={nowrapCss} dateTime={at}>
      {formatZonedTimestamp(new Date(at))}
    </time>
  )
}

/** The translations with a `<time/>` tag. */
type TimestampSentenceKey =
  | "credit-registration-admin-journey-sisu-enrolment-time"
  | "credit-registration-admin-status-enrolment-checks-stopped"
  | "credit-registration-admin-status-next-attempt"
  | "credit-registration-admin-status-next-enrolment-list-fetch"
  | "credit-registration-admin-status-next-sisu-check"
  | "credit-registration-admin-status-registered"

/** The `i18nKey` sentence with its `<time/>` tag rendered as a `ZonedTimestamp` of `at`. */
export const sentenceWithTimestamp = (
  t: CreditRegistrationTFunction,
  i18nKey: TimestampSentenceKey,
  at: string,
): React.ReactElement => (
  <Trans t={t} i18nKey={i18nKey} components={{ time: <ZonedTimestamp at={at} /> }} />
)
