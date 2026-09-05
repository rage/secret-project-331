"use client"

import { CheckCircle, Clock, Cross, ExclamationTriangle } from "@vectopus/atlas-icons-react"

import type { BadgeTone } from "../Badge"
import type { InfoboxTone } from "../Infobox"

/** `action-needed` is something the reader can fix, `failed` is not. */
export type RegistrationStatusState = "done" | "current" | "action-needed" | "failed" | "upcoming"

export const registrationStatusBadgeTone: Record<RegistrationStatusState, BadgeTone> = {
  done: "success",
  current: "info",
  "action-needed": "warning",
  failed: "danger",
  upcoming: "neutral",
}

/** Not derivable from `registrationStatusBadgeTone`: `InfoboxTone` lacks "success"/"neutral". */
export const registrationStatusInfoboxTone: Record<RegistrationStatusState, InfoboxTone> = {
  done: "info",
  current: "info",
  "action-needed": "warning",
  failed: "danger",
  upcoming: "info",
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
