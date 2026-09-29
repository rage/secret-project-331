import type {
  AdminCreditRegistrationEvent,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import type { RegistrationStatusState } from "@/shared-module/components"

import { MIDDLE_DOT } from "../constants"
import type { CreditRegistrationTFunction } from "../constants"
import {
  registrationErrorShortLabel,
  registrationLedgerStateLabel,
} from "../creditRegistrationCopy"
import { stateTone } from "./adminCreditRegistrationCopy"

/** What the pipeline, a person or Suotar did in one timeline row; picks the row's glyph. */
export type TimelineStep =
  | "created"
  | "pipeline"
  | "held_back"
  | "student"
  | "admin"
  | "student_lookup"
  | "enrolment_check"
  | "credit_search"
  | "submission"
  | "registration_check"
  | "suotar_exchange"

/** One event, read as "step: result". */
export interface TimelineEventDescription {
  step: TimelineStep
  stepLabel: string
  result: string
  tone: RegistrationStatusState
  /** A muted second line, only when it says something the result does not. */
  detail: string | null
  /** The result is the error code's short label, so only the wire code is worth adding. */
  resultNamesError: boolean
}

/** What the timeline needs from the registration row and the audit log. */
export interface TimelineContext {
  uhCourseCode: string | null
  selectedEnrolmentId: string | null
  actorName: (userId: string) => string | undefined
}

/** One visible event. */
export interface TimelineRow {
  event: AdminCreditRegistrationEvent
  description: TimelineEventDescription
  /** The event moved the row to `to_state`; otherwise the state column reads "unchanged". */
  changedState: boolean
  /** `suotar_answered_at ?? created_at`, the instant the API sorts by. */
  at: string
  /** Requested to answered, for a Suotar exchange that recorded both. */
  duration: string | null
}

/** Consecutive repeats of one unchanged-state event, oldest first; most hold one row. */
export interface TimelineGroup {
  rows: [TimelineRow, ...TimelineRow[]]
}

type Event = AdminCreditRegistrationEvent

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const field = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined)

const stringField = (value: unknown, key: string): string | null => {
  const found = field(value, key)
  return typeof found === "string" && found !== "" ? found : null
}

const numberField = (value: unknown, key: string): number | null => {
  const found = field(value, key)
  return typeof found === "number" && Number.isFinite(found) ? found : null
}

// Coupled to the backend's message: the one code-less Suotar answer that is not a refusal.
const UNANSWERED_ITEM_PREFIX = "Sisu did not answer for this item"

const SILENT_CLAIMS: readonly (readonly [CreditRegistrationState, CreditRegistrationState])[] = [
  ["ready_to_submit", "resolving_enrolment"],
  ["checking_enrolment", "submitting"],
]

const isSilentClaim = (event: Event): boolean =>
  event.kind === "state_changed" &&
  !event.message &&
  SILENT_CLAIMS.some(([from, to]) => event.from_state === from && event.to_state === to)

const changedState = (event: Event): boolean =>
  Boolean(event.to_state) && event.from_state !== event.to_state

const toneOfState = (state: CreditRegistrationState | null | undefined): RegistrationStatusState =>
  state ? stateTone(state) : "current"

const eventTime = (event: Event): string => event.suotar_answered_at ?? event.created_at

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600

/** How long Suotar took to answer, rounded to the one unit a reader compares. */
const exchangeDuration = (
  t: CreditRegistrationTFunction,
  requestedAt: string | null | undefined,
  answeredAt: string | null | undefined,
): string | null => {
  if (!requestedAt || !answeredAt) {
    return null
  }
  const seconds = (Date.parse(answeredAt) - Date.parse(requestedAt)) / MS_PER_SECOND
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null
  }
  if (seconds < 1) {
    return t("credit-registration-admin-timeline-duration-under-second")
  }
  if (seconds < SECONDS_PER_MINUTE) {
    return t("credit-registration-admin-timeline-duration-seconds", {
      seconds: Math.round(seconds),
    })
  }
  if (seconds < SECONDS_PER_HOUR) {
    return t("credit-registration-admin-timeline-duration-minutes", {
      minutes: Math.round(seconds / SECONDS_PER_MINUTE),
    })
  }
  return t("credit-registration-admin-timeline-duration-hours", {
    hours: Math.round(seconds / SECONDS_PER_HOUR),
  })
}

/** The chosen enrolment's realisation name and credits, from an enrolment answer's body. */
const enrolmentSummary = (
  t: CreditRegistrationTFunction,
  event: Event,
  selectedEnrolmentId: string | null,
): string | null => {
  const enrolments = field(field(field(event.details, "response"), "result"), "enrolments")
  if (!Array.isArray(enrolments) || enrolments.length === 0) {
    return null
  }
  const enrolment: unknown =
    enrolments.find((candidate) => stringField(candidate, "id") === selectedEnrolmentId) ??
    enrolments[0]
  const name = field(enrolment, "courseUnitRealisationName")
  const realisation = stringField(name, "en") ?? stringField(name, "fi") ?? stringField(name, "sv")
  const creditRange = field(enrolment, "credits")
  const min = numberField(creditRange, "min")
  const max = numberField(creditRange, "max")
  const credits =
    min !== null && max !== null && min !== max ? `${min}–${max}` : (max ?? min ?? null)
  const parts = [
    realisation,
    credits === null ? null : t("credit-registration-credits", { credits }),
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(MIDDLE_DOT) : null
}

interface Outcome {
  result: string
  tone: RegistrationStatusState
  resultNamesError?: boolean
  /** The message is the result, so it is not repeated under it. */
  consumesMessage?: boolean
  detail?: string | null
}

/** A code we have no wording for: the error's short label if classified, else the state reached. */
const fallbackOutcome = (t: CreditRegistrationTFunction, event: Event): Outcome => {
  const errorLabel = registrationErrorShortLabel(t, event.error_code)
  if (errorLabel) {
    return { result: errorLabel, tone: toneOfState(event.to_state), resultNamesError: true }
  }
  return {
    result: event.to_state
      ? registrationLedgerStateLabel(t, event.to_state)
      : (event.suotar_code ?? t("credit-registration-admin-timeline-result-no-clear-answer")),
    tone: toneOfState(event.to_state),
  }
}

const studentLookupOutcome = (t: CreditRegistrationTFunction, event: Event): Outcome => {
  switch (event.suotar_code) {
    case "personFound":
      return { result: t("credit-registration-admin-timeline-result-person-found"), tone: "done" }
    case "personNotFound":
      return {
        result: t("credit-registration-admin-timeline-result-person-not-found"),
        tone: "action-needed",
      }
    default:
      return fallbackOutcome(t, event)
  }
}

const enrolmentCheckOutcome = (
  t: CreditRegistrationTFunction,
  event: Event,
  context: TimelineContext,
): Outcome => {
  if (event.to_state === "duplicate") {
    return {
      result: t("credit-registration-admin-timeline-result-grade-already-held"),
      tone: "done",
    }
  }
  if (event.suotar_code === "enrolmentFound" && event.to_state === "checking_enrolment") {
    return {
      result: t("credit-registration-admin-timeline-result-enrolment-found"),
      tone: "done",
      detail: enrolmentSummary(t, event, context.selectedEnrolmentId),
    }
  }
  if (event.suotar_code === "enrolmentNotFound") {
    return {
      result: t("credit-registration-admin-timeline-result-no-enrolment-yet"),
      tone: "current",
    }
  }
  if (event.suotar_code === "enrolmentNotAccepted") {
    return {
      result: t("credit-registration-admin-timeline-result-enrolment-not-accepted-yet"),
      tone: "current",
    }
  }
  return fallbackOutcome(t, event)
}

const creditSearchOutcome = (t: CreditRegistrationTFunction, event: Event): Outcome =>
  event.to_state === "duplicate"
    ? { result: t("credit-registration-admin-timeline-result-credits-in-sisu"), tone: "done" }
    : {
        result: t("credit-registration-admin-timeline-result-credits-not-found-yet"),
        tone: "current",
      }

const submissionOutcome = (t: CreditRegistrationTFunction, event: Event): Outcome => {
  const outcomeUnknown: Outcome = {
    result: t("credit-registration-admin-timeline-result-sent-outcome-unknown"),
    tone: "action-needed",
  }
  switch (event.suotar_code) {
    case "sent":
    case "duplicateRequestItem":
      return event.to_state === "submission_uncertain"
        ? outcomeUnknown
        : { result: t("credit-registration-admin-timeline-result-sent"), tone: "current" }
    case "sisuTimeout":
      return outcomeUnknown
    case "duplicateAttainment":
      return {
        result: t("credit-registration-admin-timeline-result-credits-already-held"),
        tone: "done",
      }
    case "notImprovedAttainment":
      return { result: t("credit-registration-admin-timeline-result-not-improved"), tone: "done" }
    default:
      return {
        result: t("credit-registration-admin-timeline-result-rejected", {
          reason:
            registrationErrorShortLabel(t, event.error_code) ??
            event.suotar_code ??
            t("credit-registration-admin-timeline-result-no-clear-answer"),
        }),
        tone: event.to_state === "failed_permanent" ? "failed" : "action-needed",
        resultNamesError: Boolean(event.error_code),
      }
  }
}

const registrationCheckOutcome = (t: CreditRegistrationTFunction, event: Event): Outcome => {
  switch (event.suotar_code) {
    case "registered":
      return event.to_state === "registered"
        ? { result: t("credit-registration-admin-timeline-result-registered"), tone: "done" }
        : {
            result: t("credit-registration-admin-timeline-result-partly-registered"),
            tone: "current",
          }
    case "submissionPending":
      return {
        result: t("credit-registration-admin-timeline-result-not-registered-yet"),
        tone: "current",
      }
    case "notRegistered":
      return {
        result: t("credit-registration-admin-timeline-result-no-record-resending"),
        tone: "action-needed",
      }
    case "misregistered":
      return {
        result: t("credit-registration-admin-timeline-result-registered-wrongly"),
        tone: "failed",
      }
    default:
      return {
        result: t("credit-registration-admin-timeline-result-no-clear-answer"),
        tone: "current",
      }
  }
}

interface EventFacts {
  /** 1-based count of import exchanges so far, this one included. */
  submissionNumber: number
}

const suotarStep = (event: Event): TimelineStep => {
  switch (event.suotar_endpoint) {
    case "resolve_persons":
      return "student_lookup"
    case "resolve_enrolments":
      // Recovery after an uncertain submission reuses the enrolment endpoint to look for our credits.
      return event.from_state === "submission_uncertain" ? "credit_search" : "enrolment_check"
    case "import_attainments":
      return "submission"
    case "verify_attainments":
      return "registration_check"
    default:
      return "suotar_exchange"
  }
}

const suotarOutcome = (
  t: CreditRegistrationTFunction,
  event: Event,
  step: TimelineStep,
  context: TimelineContext,
): Outcome => {
  if (step === "suotar_exchange") {
    return fallbackOutcome(t, event)
  }
  if (!event.suotar_code) {
    return event.message?.startsWith(UNANSWERED_ITEM_PREFIX)
      ? {
          result: t("credit-registration-admin-timeline-result-no-answer"),
          tone: "action-needed",
        }
      : { result: t("credit-registration-admin-timeline-result-request-refused"), tone: "failed" }
  }
  switch (step) {
    case "student_lookup":
      return studentLookupOutcome(t, event)
    case "enrolment_check":
      return enrolmentCheckOutcome(t, event, context)
    case "credit_search":
      return creditSearchOutcome(t, event)
    case "submission":
      return submissionOutcome(t, event)
    default:
      return registrationCheckOutcome(t, event)
  }
}

const stepLabel = (
  t: CreditRegistrationTFunction,
  step: TimelineStep,
  event: Event,
  context: TimelineContext,
  facts: EventFacts,
): string => {
  switch (step) {
    case "created":
      return t("credit-registration-admin-timeline-step-created")
    case "pipeline":
      return t("credit-registration-admin-timeline-step-pipeline")
    case "held_back":
      return t("credit-registration-admin-timeline-step-held-back")
    case "student":
      return t("credit-registration-admin-timeline-step-student")
    case "admin":
      return t("credit-registration-admin-timeline-step-admin")
    case "student_lookup":
      return t("credit-registration-admin-timeline-step-student-lookup")
    case "enrolment_check": {
      const courseCode = stringField(field(event.details, "request"), "courseCode")
      const code = courseCode ?? context.uhCourseCode
      return code
        ? t("credit-registration-admin-timeline-step-enrolment-check-code", { courseCode: code })
        : t("credit-registration-admin-timeline-step-enrolment-check")
    }
    case "credit_search":
      return t("credit-registration-admin-timeline-step-credit-search")
    case "submission":
      return facts.submissionNumber >= 2
        ? t("credit-registration-admin-timeline-step-submission-n", { n: facts.submissionNumber })
        : t("credit-registration-admin-timeline-step-submission")
    case "registration_check":
      return t("credit-registration-admin-timeline-step-registration-check")
    case "suotar_exchange":
      return t("credit-registration-admin-timeline-step-suotar-exchange")
  }
}

const otherOutcome = (
  t: CreditRegistrationTFunction,
  event: Event,
  step: TimelineStep,
  context: TimelineContext,
): Outcome => {
  switch (step) {
    case "created":
      return { result: t("credit-registration-admin-timeline-result-created"), tone: "current" }
    case "held_back":
      return {
        // SUBMIT_MAX_BACKOFF in credit-registration's import claim; the event does not carry it.
        result: t("credit-registration-admin-timeline-result-held-back"),
        tone: "action-needed",
      }
    case "admin": {
      const actor =
        (event.actor_user_id ? context.actorName(event.actor_user_id) : undefined) ??
        t("credit-registration-admin-timeline-unknown-actor")
      return {
        result: event.message
          ? t("credit-registration-admin-timeline-result-admin", { actor, reason: event.message })
          : t("credit-registration-admin-timeline-result-admin-no-reason", { actor }),
        tone: "current",
        consumesMessage: true,
      }
    }
    case "student":
      return {
        result: event.message ?? t("credit-registration-admin-timeline-result-student-acted"),
        tone: "current",
        consumesMessage: true,
      }
    default:
      if (event.message) {
        return { result: event.message, tone: toneOfState(event.to_state), consumesMessage: true }
      }
      if (event.kind === "cancelled") {
        return { result: registrationLedgerStateLabel(t, "cancelled"), tone: "upcoming" }
      }
      return isSilentClaim(event)
        ? { result: t("credit-registration-admin-timeline-result-picked-up"), tone: "current" }
        : { result: t("credit-registration-admin-timeline-result-resumed"), tone: "current" }
  }
}

const eventStep = (event: Event): TimelineStep => {
  switch (event.kind) {
    case "suotar_response":
      return suotarStep(event)
    case "created":
      return "created"
    case "retry_scheduled":
      return "held_back"
    case "admin_action":
      return "admin"
    case "student_action":
      return "student"
    case "cancelled":
      return event.actor_user_id ? "admin" : "pipeline"
    default:
      return "pipeline"
  }
}

/** Reads one event as step, result and tone. */
const describeTimelineEvent = (
  t: CreditRegistrationTFunction,
  event: Event,
  context: TimelineContext,
  facts: EventFacts,
): TimelineEventDescription => {
  const step = eventStep(event)
  const outcome =
    event.kind === "suotar_response"
      ? suotarOutcome(t, event, step, context)
      : otherOutcome(t, event, step, context)
  const message = outcome.consumesMessage ? null : (event.message ?? null)
  return {
    step,
    stepLabel: stepLabel(t, step, event, context, facts),
    result: outcome.result,
    tone: outcome.tone,
    detail: outcome.detail ?? message,
    resultNamesError: outcome.resultNamesError ?? false,
  }
}

/** A claim that only says the next exchange started, which that exchange's own row already shows. */
const isRedundantClaim = (event: Event, next: Event | undefined): boolean =>
  isSilentClaim(event) &&
  !event.error_code &&
  !event.actor_user_id &&
  next?.kind === "suotar_response" &&
  next.from_state === event.to_state

const repeatKey = (event: Event): string | null =>
  changedState(event)
    ? null
    : JSON.stringify([
        event.kind,
        event.suotar_endpoint ?? null,
        event.suotar_code ?? null,
        event.error_code ?? null,
        event.message ?? null,
        event.to_state ?? null,
        event.actor_user_id ?? null,
      ])

/**
 * The timeline oldest first: redundant claims dropped, consecutive unchanged repeats collapsed.
 *
 * `newestFirst` is the API's order.
 */
export const buildTimeline = (
  t: CreditRegistrationTFunction,
  newestFirst: Event[],
  context: TimelineContext,
): TimelineGroup[] => {
  const chronological = newestFirst.toReversed()
  const groups: TimelineGroup[] = []
  let lastKey: string | null = null
  let submissionNumber = 0
  chronological.forEach((event, index) => {
    if (event.suotar_endpoint === "import_attainments") {
      submissionNumber += 1
    }
    if (isRedundantClaim(event, chronological[index + 1])) {
      return
    }
    const row: TimelineRow = {
      event,
      description: describeTimelineEvent(t, event, context, { submissionNumber }),
      changedState: changedState(event),
      at: eventTime(event),
      duration: exchangeDuration(t, event.suotar_requested_at, event.suotar_answered_at),
    }
    const key = repeatKey(event)
    const last = groups.at(-1)
    if (last && key !== null && key === lastKey) {
      last.rows.push(row)
    } else {
      groups.push({ rows: [row] })
    }
    lastKey = key
  })
  return groups
}
