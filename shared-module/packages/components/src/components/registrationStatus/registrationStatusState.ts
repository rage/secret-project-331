"use client"

import { css } from "@emotion/css"
import { CheckCircle, Clock, Cross, ExclamationTriangle } from "@vectopus/atlas-icons-react"

import type { BadgeTone } from "../Badge"

/** `action-needed` is something the reader can fix, `failed` is not. */
export type RegistrationStatusState = "done" | "current" | "action-needed" | "failed" | "upcoming"

export const registrationStatusBadgeTone: Record<RegistrationStatusState, BadgeTone> = {
  done: "success",
  current: "info",
  "action-needed": "warning",
  failed: "danger",
  upcoming: "neutral",
}

/** Shape as well as colour, so the state survives printing and colour blindness. */
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
