"use client"

import { css } from "@emotion/css"
import { CheckCircle, Clock, Cross, ExclamationTriangle } from "@vectopus/atlas-icons-react"

import type { BadgeTone } from "../Badge"

/**
 * How far a multi-step registration has got, from the reader's point of view.
 *
 * `action-needed` is deliberately distinct from `failed`: one is a thing the reader can fix and the
 * other is not, and telling them apart is the difference between a useful page and a dead end.
 */
export type RegistrationStatusState = "done" | "current" | "action-needed" | "failed" | "upcoming"

export const registrationStatusBadgeTone: Record<RegistrationStatusState, BadgeTone> = {
  done: "success",
  current: "info",
  "action-needed": "warning",
  failed: "danger",
  upcoming: "neutral",
}

/** Shape as well as colour, so the state survives being printed or read without colour vision. */
export const registrationStatusIcon: Record<
  RegistrationStatusState,
  ((props: { size?: number }) => React.ReactNode) | null
> = {
  done: CheckCircle,
  current: Clock,
  "action-needed": ExclamationTriangle,
  failed: Cross,
  upcoming: null,
}

export const registrationStatusColorCss: Record<RegistrationStatusState, string> = {
  done: css`
    color: var(--color-green-700);
  `,
  current: css`
    color: var(--color-blue-600);
  `,
  "action-needed": css`
    color: var(--color-red-700);
  `,
  failed: css`
    color: var(--color-crimson-700);
  `,
  upcoming: css`
    color: var(--color-gray-400);
  `,
}
