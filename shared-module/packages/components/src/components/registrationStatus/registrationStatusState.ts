"use client"

import {
  ArrowRightCircle,
  CheckCircle,
  Clock,
  ExclamationTriangle,
  XmarkCircle,
} from "@vectopus/atlas-icons-react"

import type { BadgeTone } from "../Badge"

/**
 * `action-needed` is something the reader can fix, `failed` is not, and `superseded` is an attempt
 * a later one has replaced.
 */
export type RegistrationStatusState =
  | "done"
  | "current"
  | "action-needed"
  | "failed"
  | "superseded"
  | "upcoming"

/** One tone per state for both the badge and the infobox, whose tone unions are the same. */
export const registrationStatusTone: Record<RegistrationStatusState, BadgeTone> = {
  done: "success",
  current: "info",
  "action-needed": "warning",
  failed: "danger",
  superseded: "neutral",
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
  failed: XmarkCircle,
  superseded: ArrowRightCircle,
  upcoming: null,
}
