import type {
  AdminCreditRegistrationEvent,
  CreditRegistrationState,
} from "@/generated/api/types.generated"
import { isRecord } from "@/shared-module/common/utils/objects"
import type { RegistrationStatusState } from "@/shared-module/components"

import { MIDDLE_DOT } from "../constants"
import type { CreditRegistrationTFunction } from "../constants"
import {
  registrationErrorShortLabel,
  registrationLedgerStateLabel,
} from "../creditRegistrationCopy"
import {
  eventKindLabel,
  registrationErrorAdminHelp,
  stateTone,
} from "./adminCreditRegistrationCopy"

/** One line of the overview: when, and what happened in plain words. */
export interface TimelineEntry {
  /** The first event's id. */
  id: string
  /** `suotar_answered_at ?? created_at` of the first event, the instant the API sorts by. */
  at: string
  /** The last event's instant when the entry folds a run of checks; otherwise null. */
  until: string | null
  sentence: string
  /** The specifics behind the sentence: Sisu's reason, the enrolment used, a person's reason. */
  detail: string | null
  /** The state the entry moved the registration to; null when it left the state as it was. */
  state: CreditRegistrationState | null
  tone: RegistrationStatusState
}

/** What the overview needs beyond the events. */
export interface TimelineContext {
  actorName: (userId: string) => string | undefined
  /** The enrolment the registration went with, picked out of an answer that listed several. */
  selectedEnrolmentId: string | null
  /** The UI language, for picking a realisation name Sisu gives in several. */
  language: string
}

type Event = AdminCreditRegistrationEvent

type CheckKind = "enrolment_check" | "credit_search" | "registration_check"

interface Outcome {
  sentence: string
  tone: RegistrationStatusState
  detail?: string | null
}

const changedState = (event: Event): boolean =>
  Boolean(event.to_state) && event.from_state !== event.to_state

/**
 * Waiting for an enrolment is where every registration starts, so it is routine here even though
 * a row that stays there long enough needs someone to act.
 */
const toneOfState = (state: CreditRegistrationState | null | undefined): RegistrationStatusState =>
  !state || state === "no_usable_enrolment" ? "current" : stateTone(state)

const field = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined)

const stringField = (value: unknown, key: string): string | null => {
  const found = field(value, key)
  return typeof found === "string" && found !== "" ? found : null
}

const numberField = (value: unknown, key: string): number | null => {
  const found = field(value, key)
  return typeof found === "number" && Number.isFinite(found) ? found : null
}

/**
 * The chosen enrolment's realisation name and credits, from an enrolment answer's body; null when
 * the answer lists several and none is the selected one.
 */
const enrolmentSummary = (
  t: CreditRegistrationTFunction,
  event: Event,
  { selectedEnrolmentId, language }: TimelineContext,
): string | null => {
  const enrolments = field(field(field(event.details, "response"), "result"), "enrolments")
  if (!Array.isArray(enrolments) || enrolments.length === 0) {
    return null
  }
  // With several to choose from, naming one we cannot identify would name the wrong one.
  const enrolment: unknown =
    enrolments.length === 1
      ? enrolments[0]
      : enrolments.find(
          (candidate) =>
            selectedEnrolmentId !== null && stringField(candidate, "id") === selectedEnrolmentId,
        )
  if (enrolment === undefined) {
    return null
  }
  const name = field(enrolment, "courseUnitRealisationName")
  const realisation =
    stringField(name, language.slice(0, 2)) ??
    stringField(name, "en") ??
    stringField(name, "fi") ??
    stringField(name, "sv")
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

/** Sisu's own code, then what it means for the administrator. */
const rejectionDetail = (t: CreditRegistrationTFunction, event: Event): string => {
  const parts = [
    event.suotar_code ?? null,
    registrationErrorAdminHelp(t, event.error_code) ??
      registrationErrorShortLabel(t, event.error_code),
  ].filter((part): part is string => Boolean(part))
  return parts.length > 0
    ? parts.join(MIDDLE_DOT)
    : t("credit-registration-admin-timeline-result-no-clear-answer")
}

const eventTime = (event: Event): string => event.suotar_answered_at ?? event.created_at

/** A code we have no wording for: the error's short label if classified, else the state reached. */
const fallbackOutcome = (t: CreditRegistrationTFunction, event: Event): Outcome => {
  const errorLabel = registrationErrorShortLabel(t, event.error_code)
  if (errorLabel) {
    return {
      sentence: errorLabel,
      tone: toneOfState(event.to_state),
      detail: registrationErrorAdminHelp(t, event.error_code),
    }
  }
  return {
    sentence: event.to_state
      ? registrationLedgerStateLabel(t, event.to_state)
      : (event.suotar_code ?? t("credit-registration-admin-timeline-result-no-clear-answer")),
    tone: toneOfState(event.to_state),
  }
}

const studentLookupOutcome = (t: CreditRegistrationTFunction, event: Event): Outcome => {
  switch (event.suotar_code) {
    case "personFound":
      return { sentence: t("credit-registration-admin-timeline-result-person-found"), tone: "done" }
    case "personNotFound":
      return {
        sentence: t("credit-registration-admin-timeline-result-person-not-found"),
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
      sentence: t("credit-registration-admin-timeline-result-grade-already-held"),
      tone: "done",
    }
  }
  switch (event.suotar_code) {
    case "enrolmentFound":
      return event.to_state === "checking_enrolment"
        ? {
            sentence: t("credit-registration-admin-timeline-result-enrolment-found"),
            tone: "done",
            detail: enrolmentSummary(t, event, context),
          }
        : fallbackOutcome(t, event)
    case "enrolmentNotFound":
      return {
        sentence: t("credit-registration-admin-timeline-result-no-enrolment-yet"),
        tone: "current",
      }
    case "enrolmentNotAccepted":
      return {
        sentence: t("credit-registration-admin-timeline-result-enrolment-not-accepted-yet"),
        tone: "current",
      }
    default:
      return fallbackOutcome(t, event)
  }
}

const creditSearchOutcome = (t: CreditRegistrationTFunction, event: Event): Outcome =>
  event.to_state === "duplicate"
    ? { sentence: t("credit-registration-admin-timeline-result-credits-in-sisu"), tone: "done" }
    : {
        sentence: t("credit-registration-admin-timeline-result-credits-not-found-yet"),
        tone: "current",
      }

const submissionOutcome = (t: CreditRegistrationTFunction, event: Event): Outcome => {
  const outcomeUnknown: Outcome = {
    sentence: t("credit-registration-admin-timeline-result-sent-outcome-unknown"),
    tone: "action-needed",
  }
  switch (event.suotar_code) {
    case "sent":
    case "duplicateRequestItem":
      return event.to_state === "submission_uncertain"
        ? outcomeUnknown
        : { sentence: t("credit-registration-admin-timeline-result-sent"), tone: "current" }
    case "sisuTimeout":
      return outcomeUnknown
    case "duplicateAttainment":
      return {
        sentence: t("credit-registration-admin-timeline-result-credits-already-held"),
        tone: "done",
      }
    case "notImprovedAttainment":
      return {
        sentence: t("credit-registration-admin-timeline-result-not-improved"),
        tone: "done",
      }
    default:
      return {
        sentence: t("credit-registration-admin-timeline-result-rejected"),
        tone: event.to_state === "failed_permanent" ? "failed" : "action-needed",
        detail: rejectionDetail(t, event),
      }
  }
}

const registrationCheckOutcome = (t: CreditRegistrationTFunction, event: Event): Outcome => {
  switch (event.suotar_code) {
    case "registered":
      return event.to_state === "registered"
        ? { sentence: t("credit-registration-admin-timeline-result-registered"), tone: "done" }
        : {
            sentence: t("credit-registration-admin-timeline-result-partly-registered"),
            tone: "current",
          }
    case "submissionPending":
      return {
        sentence: t("credit-registration-admin-timeline-result-not-registered-yet"),
        tone: "current",
      }
    case "notRegistered":
      return {
        sentence: t("credit-registration-admin-timeline-result-no-record-resending"),
        tone: "action-needed",
      }
    case "misregistered":
      return {
        sentence: t("credit-registration-admin-timeline-result-registered-wrongly"),
        tone: "failed",
      }
    default:
      return {
        sentence: t("credit-registration-admin-timeline-result-no-clear-answer"),
        tone: "current",
      }
  }
}

/** The repeatable lookup an exchange was, or null for one that is a step of its own. */
const checkKind = (event: Event): CheckKind | null => {
  switch (event.suotar_endpoint) {
    case "resolve_enrolments":
      // Recovery after an uncertain submission reuses the enrolment endpoint to look for our credits.
      return event.from_state === "submission_uncertain" ? "credit_search" : "enrolment_check"
    case "verify_attainments":
      return "registration_check"
    default:
      return null
  }
}

const suotarOutcome = (
  t: CreditRegistrationTFunction,
  event: Event,
  context: TimelineContext,
): Outcome => {
  switch (event.suotar_answer) {
    case "refused":
      return {
        sentence: t("credit-registration-admin-timeline-result-request-refused"),
        tone: "failed",
      }
    case "unanswered":
      return {
        sentence: t("credit-registration-admin-timeline-result-no-answer"),
        tone: "action-needed",
      }
  }
  if (!event.suotar_code) {
    return fallbackOutcome(t, event)
  }
  switch (event.suotar_endpoint) {
    case "resolve_persons":
      return studentLookupOutcome(t, event)
    case "import_attainments":
      return submissionOutcome(t, event)
  }
  switch (checkKind(event)) {
    case "enrolment_check":
      return enrolmentCheckOutcome(t, event, context)
    case "credit_search":
      return creditSearchOutcome(t, event)
    case "registration_check":
      return registrationCheckOutcome(t, event)
    default:
      return fallbackOutcome(t, event)
  }
}

/** "{action} by {actor}", with the reason they gave as the detail. */
const byActor = (
  t: CreditRegistrationTFunction,
  action: string,
  event: Event,
  context: TimelineContext,
  tone: RegistrationStatusState,
): Outcome => {
  const actor =
    (event.actor_user_id ? context.actorName(event.actor_user_id) : undefined) ??
    t("credit-registration-admin-timeline-unknown-actor")
  return {
    sentence: t("credit-registration-admin-timeline-by-actor", { action, actor }),
    tone,
    detail: event.message ?? null,
  }
}

const movedOrActed = (t: CreditRegistrationTFunction, event: Event): string =>
  changedState(event) && event.to_state
    ? t("credit-registration-admin-timeline-moved-to", {
        state: registrationLedgerStateLabel(t, event.to_state),
      })
    : eventKindLabel(t, event.kind)

const describe = (
  t: CreditRegistrationTFunction,
  event: Event,
  context: TimelineContext,
): Outcome => {
  const tone = toneOfState(event.to_state)
  switch (event.kind) {
    case "suotar_response":
      return suotarOutcome(t, event, context)
    case "created":
      return { sentence: t("credit-registration-admin-timeline-result-created"), tone: "current" }
    case "retry_scheduled":
      // SUBMIT_MAX_BACKOFF in credit-registration's import claim; the event does not carry it.
      return {
        sentence: t("credit-registration-admin-timeline-result-held-back"),
        tone: "action-needed",
      }
    case "student_action":
      return { sentence: event.message ?? eventKindLabel(t, event.kind), tone: "current" }
    case "cancelled": {
      const cancelled = registrationLedgerStateLabel(t, "cancelled")
      if (event.actor_user_id) {
        return byActor(t, cancelled, event, context, "upcoming")
      }
      return { sentence: event.message ?? cancelled, tone: "upcoming" }
    }
    case "admin_action":
      return byActor(t, movedOrActed(t, event), event, context, tone)
    default:
      return event.actor_user_id
        ? byActor(t, movedOrActed(t, event), event, context, tone)
        : { sentence: event.message ?? movedOrActed(t, event), tone }
  }
}

/**
 * Bookkeeping nobody needs to read: a silent claim or resume, and a student lookup that found the
 * person it was looking for without changing anything.
 */
const isNoise = (event: Event): boolean =>
  (event.kind === "state_changed" && !event.message && !event.actor_user_id) ||
  (event.kind === "suotar_response" &&
    event.suotar_endpoint === "resolve_persons" &&
    event.suotar_code === "personFound" &&
    !changedState(event))

/** Consecutive events with the same key fold into one entry; null for a milestone. */
const foldKey = (event: Event): string | null => {
  const kind = checkKind(event)
  if (event.kind !== "suotar_response" || kind === null || changedState(event)) {
    return null
  }
  return JSON.stringify([kind, event.suotar_code ?? null, event.suotar_answer ?? null])
}

const foldedSentence = (
  t: CreditRegistrationTFunction,
  event: Event,
  count: number,
  single: string,
): string => {
  if (event.suotar_answer === "answered" || !event.suotar_answer) {
    switch (checkKind(event)) {
      case "enrolment_check":
        if (event.suotar_code === "enrolmentNotFound") {
          return t("credit-registration-admin-timeline-checked-enrolment-none", { count })
        }
        if (event.suotar_code === "enrolmentNotAccepted") {
          return t("credit-registration-admin-timeline-checked-enrolment-not-accepted", { count })
        }
        break
      case "credit_search":
        return t("credit-registration-admin-timeline-checked-credits-not-found", { count })
      case "registration_check":
        return t("credit-registration-admin-timeline-waited-for-confirmation", { count })
    }
  }
  return t("credit-registration-admin-timeline-repeated", { sentence: single, count })
}

/**
 * The registration's story, oldest first: milestones one per line, bookkeeping dropped, and each
 * run of unchanged checks folded into one line with its count.
 *
 * `newestFirst` is the API's order.
 */
export const buildTimeline = (
  t: CreditRegistrationTFunction,
  newestFirst: Event[],
  context: TimelineContext,
): TimelineEntry[] => {
  const runs: { key: string | null; events: [Event, ...Event[]] }[] = []
  for (const event of newestFirst.toReversed()) {
    if (isNoise(event)) {
      continue
    }
    const key = foldKey(event)
    const last = runs.at(-1)
    if (last && key !== null && last.key === key) {
      last.events.push(event)
    } else {
      runs.push({ key, events: [event] })
    }
  }
  return runs.map(({ key, events }) => {
    const [first] = events
    const outcome = describe(t, first, context)
    const newest = events.at(-1) ?? first
    return {
      id: first.id,
      at: eventTime(first),
      until: events.length > 1 ? eventTime(newest) : null,
      sentence:
        key === null ? outcome.sentence : foldedSentence(t, first, events.length, outcome.sentence),
      // A fold repeats one answer, so only a milestone can carry its own specifics.
      detail: key === null ? (outcome.detail ?? null) : null,
      state: changedState(first) ? (first.to_state ?? null) : null,
      tone: outcome.tone,
    }
  })
}
