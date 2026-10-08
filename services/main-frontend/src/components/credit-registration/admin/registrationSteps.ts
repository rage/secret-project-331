import type {
  AdminCreditRegistrationEvent,
  AdminCreditRegistrationRow,
  CreditRegistrationState,
} from "@/generated/api/types.generated"

export type RegistrationStepKey = "completed" | "enrolment" | "sent" | "partial" | "registered"

export type RegistrationStepStatus = "done" | "current" | "stopped" | "skipped" | "upcoming"

/** How the last step ended when it is not a plain registration. */
export type RegistrationEnding = "duplicate" | "not_improved"

export interface RegistrationStep {
  key: RegistrationStepKey
  status: RegistrationStepStatus
  /** ISO timestamp; null when the step has none or it is unknown. */
  at: string | null
  ending?: RegistrationEnding | undefined
}

const STEP_KEYS: RegistrationStepKey[] = ["completed", "enrolment", "sent", "partial", "registered"]

const ENROLMENT_FOUND_STATES: ReadonlySet<CreditRegistrationState> = new Set([
  "checking_enrolment",
  "submitting",
  "submission_uncertain",
  "awaiting_verification",
  "partially_registered",
  "registered",
  "duplicate",
  "not_improved",
  "misregistered",
])

/** When the row first reached a state that needs an enrolment to have been found. */
export const enrolmentFoundAt = (events: AdminCreditRegistrationEvent[]): string | null => {
  let earliest: string | null = null
  for (const event of events) {
    if (
      event.to_state &&
      ENROLMENT_FOUND_STATES.has(event.to_state) &&
      (earliest === null || new Date(event.created_at) < new Date(earliest))
    ) {
      earliest = event.created_at
    }
  }
  return earliest
}

interface Position {
  index: number
  kind: "current" | "stopped" | "finished"
}

const COMPLETED = 0
const ENROLMENT = 1
const SENT = 2
const PARTIAL = 3
const REGISTERED = 4

const position = (row: AdminCreditRegistrationRow, hasEnrolment: boolean): Position => {
  const stoppedAt = hasEnrolment || row.submitted_at ? SENT : ENROLMENT
  switch (row.state) {
    case "pending":
      return { index: row.pending_reason === "completion" ? COMPLETED : ENROLMENT, kind: "current" }
    case "ready_to_submit":
    case "resolving_enrolment":
    case "no_usable_enrolment":
      return { index: ENROLMENT, kind: "current" }
    case "checking_enrolment":
    case "submitting":
    case "submission_uncertain":
    case "awaiting_verification":
      return { index: SENT, kind: "current" }
    case "partially_registered":
      return { index: PARTIAL, kind: "current" }
    case "registered":
    case "duplicate":
    case "not_improved":
      return { index: REGISTERED, kind: "finished" }
    case "misregistered":
      return { index: REGISTERED, kind: "stopped" }
    case "failed_retryable":
    case "failed_permanent":
    case "blocked":
    case "cancelled":
      return { index: stoppedAt, kind: "stopped" }
  }
}

const endingOf = (state: CreditRegistrationState): RegistrationEnding | undefined =>
  state === "duplicate" || state === "not_improved" ? state : undefined

/** The five lifecycle steps of a registration with each one's status and time. */
export const deriveRegistrationSteps = (
  row: AdminCreditRegistrationRow,
  events: AdminCreditRegistrationEvent[],
): RegistrationStep[] => {
  const foundAt = enrolmentFoundAt(events)
  const { index: activeIndex, kind } = position(row, foundAt !== null)
  const times: (string | null | undefined)[] = [
    row.completion_date,
    foundAt,
    row.submitted_at ?? null,
    row.partially_registered_at ?? null,
    row.registered_at ?? row.terminal_at ?? null,
  ]
  const ending = endingOf(row.state)
  return STEP_KEYS.map((key, index): RegistrationStep => {
    const at = times[index] ?? null
    if (index < activeIndex) {
      const skipped = index === PARTIAL && !at
      return { key, status: skipped ? "skipped" : "done", at }
    }
    if (index === activeIndex) {
      const status = kind === "current" ? "current" : kind === "stopped" ? "stopped" : "done"
      return { key, status, at, ending }
    }
    return { key, status: "upcoming", at: null }
  })
}
