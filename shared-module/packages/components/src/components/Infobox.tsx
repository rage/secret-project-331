"use client"

import { css, cx } from "@emotion/css"
import {
  CheckCircle,
  ExclamationTriangle,
  InfoCircle,
  MinusCircle,
} from "@vectopus/atlas-icons-react"
import React from "react"

export type InfoboxTone = "neutral" | "info" | "success" | "warning" | "danger"

export interface InfoboxProps {
  /**
   * `info` explains, `success` confirms something worked, `warning` flags something to act on,
   * `danger` reports a failure — these fills darken in that order, so two boxes on one page read
   * as ranked. `neutral` sits outside that order: a fact worth setting apart visually, but not
   * news.
   */
  tone?: InfoboxTone
  heading?: React.ReactNode
  children: React.ReactNode
  /** Live region; only for boxes that appear after a user action, not on first paint. */
  announce?: boolean
  className?: string
}

/** Below this the icon shares the heading's line instead of holding a column of its own. */
const ICON_IN_LINE_BELOW_PX = 480

// Metrics match `common`'s GenericInfobox: the two appear side by side on many pages.
const rootCss = css`
  display: flex;
  /* Anchors the icon to the first line; centring strands it beside the middle of a long body. */
  align-items: flex-start;
  gap: var(--space-3);
  padding: 0.875rem 1rem;
  /* An accented edge rather than a full outline: these often sit inside a card or dialog that
     already has one, and a second rounded box inside the first reads as stray chrome. Width is
     per-side but the colour stays a single value, so a tone is still one border-color. */
  border-style: solid;
  border-width: 0 0 0 3px;
  border-color: transparent;
  border-radius: 0 var(--surface-radius) var(--surface-radius) 0;
  overflow-x: auto;

  /* A column of its own for the icon costs the body part of every line, which on a phone adds two
     wrapped lines to a two-sentence body. Blocking lets the floated icon take the heading's line. */
  @media (max-width: ${ICON_IN_LINE_BELOW_PX - 0.02}px) {
    display: block;
  }
`

/** One entry per tone: stripe, ground and icon, so adding a tone is one edit rather than three. */
const tones: Record<InfoboxTone, { icon: React.ComponentType<{ size?: number }>; css: string }> = {
  neutral: {
    icon: MinusCircle,
    css: css`
      border-color: var(--color-gray-400);
      background: var(--color-gray-50);
      --infobox-icon: var(--color-gray-500);
    `,
  },
  info: {
    icon: InfoCircle,
    css: css`
      border-color: var(--color-blue-500);
      background: var(--color-blue-25);
      --infobox-icon: var(--color-blue-500);
    `,
  },
  success: {
    icon: CheckCircle,
    css: css`
      border-color: var(--color-green-600);
      background: var(--color-green-50);
      --infobox-icon: var(--color-green-600);
    `,
  },
  warning: {
    icon: ExclamationTriangle,
    css: css`
      border-color: var(--color-yellow-700);
      background: var(--color-yellow-100);
      /* The yellow ramp is not contrast-safe as ink, so the icon stays grey. */
      --infobox-icon: var(--color-gray-700);
    `,
  },
  danger: {
    icon: ExclamationTriangle,
    css: css`
      border-color: var(--color-crimson-600);
      background: var(--color-crimson-75);
      --infobox-icon: var(--color-crimson-600);
    `,
  },
}

const iconCss = css`
  display: inline-flex;
  align-items: center;
  flex: none;
  color: var(--infobox-icon);

  @media (max-width: ${ICON_IN_LINE_BELOW_PX - 0.02}px) {
    float: left;
    margin-right: var(--space-3);
  }
`

const bodyCss = css`
  flex: 1;
`

const headingCss = css`
  display: block;
  margin-bottom: var(--space-2);
  color: var(--color-gray-700);
  font-weight: 600;
`

export const Infobox: React.FC<InfoboxProps> = ({
  tone = "info",
  heading,
  children,
  announce = false,
  className,
}) => {
  const { icon: Icon, css: toneCss } = tones[tone]

  return (
    <div
      className={cx(rootCss, toneCss, className)}
      // `alert` interrupts a screen reader, `status` waits for a pause; only a tone that asks for
      // action is worth an interruption.
      role={announce ? (tone === "warning" || tone === "danger" ? "alert" : "status") : undefined}
    >
      <span className={iconCss} aria-hidden="true">
        <Icon />
      </span>
      <div className={bodyCss}>
        {heading ? <strong className={headingCss}>{heading}</strong> : null}
        {children}
      </div>
    </div>
  )
}
