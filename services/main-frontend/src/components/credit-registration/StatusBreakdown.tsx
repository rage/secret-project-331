"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import type { RegistrationStatusState } from "@/shared-module/components"
import { Link } from "@/shared-module/components"

import { formatSharePercent } from "./admin/percent"
import { CREDIT_REGISTRATION_NS, LINK_QUIET } from "./constants"
import { noteCss, statusTriggerCss } from "./styles"

const FULL_PERCENT = 100

export interface StatusBreakdownSegment {
  key: string
  /** What this slice is, in the one status vocabulary. */
  label: string
  count: number
  /** Picks the segment's colour, from the same tones the status badges use. */
  state: RegistrationStatusState
  /** Opens the rows this slice counts. Pass one of `href` and `onSelect`, or neither. */
  href?: string
  onSelect?: () => void
}

export interface StatusBreakdownProps {
  /**
   * What the bar partitions, e.g. "Default module". The accessible name of the whole breakdown,
   * rendered for screen readers only — the page keeps its own visible heading.
   */
  label: string
  segments: readonly StatusBreakdownSegment[]
  /**
   * The whole the segments divide. Defaults to their sum. A larger total renders the difference as
   * a visible unaccounted slice rather than scaling the segments to fill the bar, so a breakdown
   * that does not add up says so.
   */
  total?: number
}

/**
 * Fills matching `registrationStatusBadgeTone`'s hues. Solid rather than the badges' tints: a
 * 4-pixel slice of a pale fill is invisible, and the legend beside it carries the meaning anyway.
 */
const segmentFillCss: Record<RegistrationStatusState, string> = {
  done: css`
    background: var(--color-green-600);
  `,
  current: css`
    background: var(--color-blue-600);
  `,
  "action-needed": css`
    background: var(--color-yellow-700);
  `,
  failed: css`
    background: var(--color-crimson-700);
  `,
  superseded: css`
    background: var(--color-gray-400);
  `,
  upcoming: css`
    background: var(--color-gray-300);
  `,
}

const remainderFillCss = css`
  background: repeating-linear-gradient(
    45deg,
    var(--color-gray-200) 0,
    var(--color-gray-200) 4px,
    var(--color-gray-100) 4px,
    var(--color-gray-100) 8px
  );
`

const rootCss = css`
  display: grid;
  gap: var(--space-3);
`

const barCss = css`
  display: flex;
  overflow: hidden;
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: var(--color-gray-100);

  /* Hairlines between slices: two adjacent fills of similar lightness otherwise read as one. */
  > span + span {
    box-shadow: inset 1px 0 0 var(--color-clear-50);
  }
`

const legendCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-1);
`

const legendRowCss = css`
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
`

const swatchCss = css`
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  /* The baseline of the text beside it, not its top. */
  transform: translateY(-1px);
`

const countCss = css`
  color: var(--color-gray-700);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

/**
 * How one number splits between statuses: a segmented full-width bar and a legend with counts.
 *
 * For a single value use `StatTile`, and for a value against a maximum use `Meter` — this one
 * answers "how is this total divided", which neither of those expresses. A segment counting zero
 * is left out of both bar and legend; a breakdown with nothing in it renders its empty note.
 */
const StatusBreakdown: React.FC<StatusBreakdownProps> = ({ label, segments, total }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const shown = segments.filter((segment) => segment.count > 0)
  const counted = shown.reduce((sum, segment) => sum + segment.count, 0)
  const whole = Math.max(total ?? counted, counted)
  const remainder = whole - counted

  if (whole === 0) {
    return <p className={noteCss}>{t("credit-registration-breakdown-empty")}</p>
  }

  // One generated class per distinct share; the repo's lint rules out an inline width.
  const shareCss = (count: number) => css`
    width: ${(count / whole) * FULL_PERCENT}%;
  `

  return (
    <div className={rootCss}>
      <VisuallyHidden>{label}</VisuallyHidden>
      <span className={barCss} aria-hidden="true">
        {shown.map((segment) => (
          <span
            key={segment.key}
            className={cx(segmentFillCss[segment.state], shareCss(segment.count))}
          />
        ))}
        {remainder > 0 && <span className={cx(remainderFillCss, shareCss(remainder))} />}
      </span>
      <ul className={legendCss}>
        {shown.map((segment) => (
          <LegendRow key={segment.key} segment={segment} whole={whole} />
        ))}
        {remainder > 0 && (
          <li className={legendRowCss}>
            <span className={cx(swatchCss, remainderFillCss)} aria-hidden="true" />
            <span className={noteCss}>{t("credit-registration-breakdown-remainder")}</span>
            <span className={countCss}>{remainder}</span>
          </li>
        )}
      </ul>
    </div>
  )
}

const LegendRow: React.FC<{ segment: StatusBreakdownSegment; whole: number }> = ({
  segment,
  whole,
}) => {
  const { i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  const body = (
    <>
      <span className={cx(swatchCss, segmentFillCss[segment.state])} aria-hidden="true" />
      <span>{segment.label}</span>
      <span className={countCss}>{segment.count}</span>
      <span className={noteCss}>{formatSharePercent(segment.count, whole, i18n.language)}</span>
    </>
  )

  if (segment.href) {
    return (
      <li>
        <Link href={segment.href} appearance={LINK_QUIET} className={legendRowCss}>
          {body}
        </Link>
      </li>
    )
  }
  if (segment.onSelect) {
    return (
      <li>
        <button
          type="button"
          className={cx(statusTriggerCss, legendRowCss)}
          onClick={segment.onSelect}
        >
          {body}
        </button>
      </li>
    )
  }
  return <li className={legendRowCss}>{body}</li>
}

export default StatusBreakdown
