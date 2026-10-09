import type {
  AdminCreditRegistrationDetails,
  AdminCreditRegistrationEvent,
  AdminCreditRegistrationRow,
  CreditRegistrationState,
  TimelineStep,
} from "@/generated/api/types.generated"

import type { CreditRegistrationTFunction } from "../constants"
import { formatZonedTimestamp } from "../ZonedTimestamp"
import { registrationStatusLines } from "./registrationStatus"
import type { RegistrationStatusLines } from "./registrationStatus"
import type { TimelineEntry } from "./timelineRows"
import {
  ATTENTION_STEPS,
  ENGAGEMENT_STEPS,
  FINISHED_STEPS,
  timelineStepLabel,
} from "./timelineSteps"

/** A column of the registration page's timeline; Starting registration is a column only there. */
export type JourneyPhaseKey =
  | "course"
  | "starting_registration"
  | "student_number"
  | "registering"
  | "confirmation"

export type JourneyStepStatus = "done" | "current" | "upcoming"

export interface JourneyStep {
  key: string
  label: string
  status: JourneyStepStatus
  /** Current, and waiting for a person. */
  isAttention: boolean
  at: string | null
  /** Seconds since the step before it; null for the first step or one that came earlier. */
  secsAfterPrevious: number | null
  /** One more fact about the step, such as how they enrolled. */
  note: string | null
  /** The events that led up to the step, or, for the current step, everything since. */
  entries: TimelineEntry[]
}

export type JourneyPhaseStatus = "done" | "current" | "upcoming" | "skipped"

export interface JourneyPhase {
  key: JourneyPhaseKey
  status: JourneyPhaseStatus
  steps: JourneyStep[]
  /** The current phase's two-line status. */
  current: RegistrationStatusLines | null
  /** How a finished phase ended, when it ended in something other than plain "done". */
  ending: TimelineStep | null
}

export const JOURNEY_PHASES: readonly JourneyPhaseKey[] = [
  "course",
  "starting_registration",
  "student_number",
  "registering",
  "confirmation",
]

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

const ACCEPTED_STATES: ReadonlySet<CreditRegistrationState> = new Set([
  "awaiting_verification",
  "partially_registered",
  "registered",
  "misregistered",
])

type Event = AdminCreditRegistrationEvent

const firstReaching = (
  events: Event[],
  states: ReadonlySet<CreditRegistrationState>,
): string | null =>
  events.find(
    (event) => event.to_state && event.from_state !== event.to_state && states.has(event.to_state),
  )?.created_at ?? null

const firstSent = (events: Event[]): string | null => {
  const sent = events.find((event) => event.suotar_endpoint === "import_attainments")
  return sent ? (sent.suotar_requested_at ?? sent.created_at) : null
}

/** The phase a row's own position puts it in, before the student's activity is considered. */
const PHASE_OF_ROW = {
  course: "course",
  student_number: "student_number",
  registering: "registering",
  confirmation: "confirmation",
  ended: null,
} as const satisfies Record<AdminCreditRegistrationRow["phase"], JourneyPhaseKey | null>

/** The phase the newest attempt is in now; null once it has finished. */
const currentPhaseOf = (row: AdminCreditRegistrationRow): JourneyPhaseKey | null => {
  if (FINISHED_STEPS.has(row.timeline_step)) {
    return null
  }
  if (ENGAGEMENT_STEPS.has(row.timeline_step) && row.engagement !== "pressed") {
    return "starting_registration"
  }
  return PHASE_OF_ROW[row.phase]
}

interface Slot {
  key: string
  label: string
  at: string | null
  note?: string | null
}

const toStep = (
  slot: Slot,
  status: JourneyStepStatus,
): Omit<JourneyStep, "secsAfterPrevious" | "entries"> => ({
  key: slot.key,
  label: slot.label,
  status,
  isAttention: false,
  at: status === "done" ? slot.at : null,
  note: status === "done" ? (slot.note ?? null) : null,
})

/**
 * One phase's steps: the slots that happened as done, then the row's current step, standing in for
 * the slot it `replaces` if any, then the rest as upcoming. In a phase the row has left, slots that
 * never happened are left out; in one it has not reached, the rest are all upcoming.
 */
const phaseSteps = (
  slots: Slot[],
  phaseStatus: "past" | "current" | "future",
  current: { label: string; isAttention: boolean; replaces: string | null } | null,
): Omit<JourneyStep, "secsAfterPrevious" | "entries">[] => {
  const done = slots.filter((slot) => slot.at !== null)
  if (phaseStatus === "past") {
    return done.map((slot) => toStep(slot, "done"))
  }
  if (phaseStatus === "future") {
    return slots.map((slot) => toStep(slot, slot.at === null ? "upcoming" : "done"))
  }
  const pending = slots.filter((slot) => slot.at === null)
  const steps = done.map((slot) => toStep(slot, "done"))
  if (current) {
    steps.push({
      key: current.replaces ?? "current",
      label: current.label,
      status: "current",
      isAttention: current.isAttention,
      at: null,
      note: null,
    })
  }
  return [
    ...steps,
    ...pending
      .filter((slot) => slot.key !== current?.replaces)
      .map((slot) => toStep(slot, "upcoming")),
  ]
}

/** The slot a current Registering or Confirmation step stands in for, and that slot's phase. */
const REPLACED_SLOT: Partial<Record<TimelineStep, { slot: string; phase: JourneyPhaseKey }>> = {
  looking_for_enrolment: { slot: "enrolment_found", phase: "registering" },
  waiting_for_enrolment: { slot: "enrolment_found", phase: "registering" },
  sending: { slot: "sent", phase: "registering" },
  answer_unclear: { slot: "accepted", phase: "registering" },
  waiting_for_assessment_item: { slot: "assessment_item", phase: "confirmation" },
  waiting_for_course_unit: { slot: "course_unit", phase: "confirmation" },
}

/** The phase a step with no slot of its own is shown in, as an extra current step. */
const INSERTED_IN: Partial<Record<TimelineStep, JourneyPhaseKey>> = {
  course_not_registrable_yet: "course",
  held_for_course_code: "registering",
  recorded_wrongly: "confirmation",
}

/**
 * Hands each event entry to the done step it led up to, and what came after the last one to the
 * current step, so expanding a step shows how it got there.
 */
const attachEntries = (phases: JourneyPhase[], entries: TimelineEntry[]) => {
  const steps = phases.flatMap((phase) => phase.steps)
  const done = steps
    .filter((step) => step.status === "done" && step.at !== null)
    .toSorted((a, b) => Date.parse(a.at ?? "") - Date.parse(b.at ?? ""))
  const tail = steps.find((step) => step.status === "current") ?? done.at(-1)
  for (const entry of entries) {
    const owner = done.find((step) => Date.parse(step.at ?? "") >= Date.parse(entry.at)) ?? tail
    owner?.entries.push(entry)
  }
}

/** Fills in each done step's distance from the one before it, in reading order. */
const attachDurations = (phases: JourneyPhase[]) => {
  let previous: number | null = null
  for (const step of phases.flatMap((phase) => phase.steps)) {
    if (step.status !== "done" || step.at === null) {
      continue
    }
    const at = Date.parse(step.at)
    if (previous !== null && at >= previous) {
      step.secsAfterPrevious = (at - previous) / 1000
    }
    previous = previous === null ? at : Math.max(previous, at)
  }
}

/**
 * The whole completion's story as phase columns, whichever attempt's page is open: the newest
 * attempt decides where it stands, and every attempt's events are in it.
 *
 * `entries` is `buildTimeline` over `details.events`.
 */
export const buildJourney = (
  t: CreditRegistrationTFunction,
  details: AdminCreditRegistrationDetails,
  entries: TimelineEntry[],
): JourneyPhase[] => {
  const newest = details.attempts[0] ?? details.registration
  const newestEvents = details.events.filter((event) => event.credit_registration_id === newest.id)
  const { journey } = details
  const step = newest.timeline_step
  const currentPhase = currentPhaseOf(newest)
  const currentIndex =
    currentPhase === null ? JOURNEY_PHASES.length : JOURNEY_PHASES.indexOf(currentPhase)
  const positionOf = (phase: JourneyPhaseKey): "past" | "current" | "future" => {
    const index = JOURNEY_PHASES.indexOf(phase)
    return index < currentIndex ? "past" : index === currentIndex ? "current" : "future"
  }
  const isAttention = ATTENTION_STEPS.has(step) || newest.attention_standing === "needs_attention"
  const currentStep = (
    replaces: string | null,
  ): { label: string; isAttention: boolean; replaces: string | null } => ({
    label: timelineStepLabel(t, step),
    isAttention,
    replaces,
  })

  const pleaseRegister = details.notification_emails.find((mail) => mail.kind === "action_needed")
  const courseSlots: Slot[] = [
    {
      key: "course_started",
      label: t("credit-registration-admin-journey-course-started"),
      at: journey.course_started_at ?? null,
    },
    {
      key: "course_finished",
      label: t("credit-registration-admin-journey-course-finished"),
      at: newest.completion_date,
    },
  ]
  if (pleaseRegister?.send_status.sent_at) {
    courseSlots.push({
      key: "please_register_sent",
      label: t("credit-registration-admin-journey-please-register-sent"),
      at: pleaseRegister.send_status.sent_at,
    })
  }

  const startingSlots: Slot[] = [
    {
      key: "page_opened",
      label: t("credit-registration-admin-journey-page-opened"),
      at: journey.first_visited_at ?? null,
    },
    {
      key: "pressed",
      label: t("credit-registration-admin-journey-pressed"),
      at: journey.pressed_at ?? null,
      note: journey.enrolment_route
        ? t(
            journey.enrolment_route === "open_university"
              ? "credit-registration-admin-enrolment-route-open-university"
              : "credit-registration-admin-enrolment-route-university-of-helsinki",
          )
        : null,
    },
  ]

  const firstCreatedAt = Math.min(
    ...details.attempts.map((attempt) => Date.parse(attempt.created_at)),
  )
  const linkedAt = newest.verified_student_number_at ?? null
  const isReturning = linkedAt !== null && Date.parse(linkedAt) < firstCreatedAt
  const usedLinkingEmail =
    newest.verified_student_number_via === "emailed_link"
      ? details.linking_emails.find(
          (mail) => mail.token_used_at && mail.token_claimed_by_user_id === newest.user_id,
        )
      : undefined
  const studentNumberSlots: Slot[] = isReturning
    ? [
        {
          key: "already_linked",
          label: t("credit-registration-admin-journey-already-linked"),
          at: linkedAt,
        },
      ]
    : [
        ...(usedLinkingEmail
          ? [
              {
                key: "on_enrolment_list",
                label: t("credit-registration-admin-journey-on-enrolment-list"),
                at: usedLinkingEmail.claimed_at,
              },
              {
                key: "linking_email_sent",
                label: t("credit-registration-admin-journey-linking-email-sent"),
                at: usedLinkingEmail.send_status.sent_at ?? null,
              },
            ]
          : []),
        {
          key: "linked",
          label: t("credit-registration-admin-journey-linked"),
          at: linkedAt,
        },
      ].filter((slot) => slot.at !== null)

  const enrolmentFoundAt = firstReaching(newestEvents, ENROLMENT_FOUND_STATES)
  const registeringSlots: Slot[] = [
    {
      key: "enrolment_found",
      label: t("credit-registration-admin-journey-enrolment-found"),
      at: enrolmentFoundAt,
      note:
        enrolmentFoundAt && journey.sisu_enrolled_at
          ? t("credit-registration-admin-journey-sisu-enrolment-time", {
              time: formatZonedTimestamp(new Date(journey.sisu_enrolled_at)),
            })
          : null,
    },
    {
      key: "sent",
      label: t("credit-registration-admin-journey-sent"),
      at: newest.submitted_at ?? firstSent(newestEvents),
    },
    {
      key: "accepted",
      label: t("credit-registration-admin-journey-accepted"),
      at: firstReaching(newestEvents, ACCEPTED_STATES),
    },
  ]

  const confirmationSlots: Slot[] = [
    {
      key: "assessment_item",
      label: t("credit-registration-admin-journey-assessment-item"),
      at: newest.partially_registered_at ?? newest.registered_at ?? null,
    },
    {
      key: "course_unit",
      label: t("credit-registration-admin-journey-course-unit"),
      at: newest.registered_at ?? null,
    },
  ]

  const currentIn = (phase: JourneyPhaseKey) => {
    if (step === "needs_a_person") {
      // Stopped at whichever Registering step it had not reached.
      return phase === "registering"
        ? currentStep(registeringSlots.find((slot) => slot.at === null)?.key ?? null)
        : null
    }
    if (INSERTED_IN[step] === phase) {
      return currentStep(null)
    }
    const replaced = REPLACED_SLOT[step]
    return replaced?.phase === phase ? currentStep(replaced.slot) : null
  }

  const stepsOf = (phase: JourneyPhaseKey) => {
    const position = positionOf(phase)
    switch (phase) {
      case "course":
        return phaseSteps(courseSlots, position, currentIn(phase))
      case "starting_registration": {
        if (position !== "current") {
          return phaseSteps(startingSlots, position, null)
        }
        // What the student does next is the current step; there is no ledger step for it.
        const nextIndex = startingSlots.findIndex((slot) => slot.at === null)
        return startingSlots.map((slot, index) => ({
          key: slot.key,
          label: slot.label,
          status: (slot.at !== null
            ? "done"
            : index === nextIndex
              ? "current"
              : "upcoming") as JourneyStepStatus,
          isAttention: false,
          at: slot.at,
          note: slot.at !== null ? (slot.note ?? null) : null,
        }))
      }
      case "student_number":
        if (linkedAt === null) {
          // Until they link, we do not know who they are in Sisu, so nothing more can be said.
          return [
            {
              key: "not_linked",
              label: timelineStepLabel(t, "waiting_for_student_number"),
              status: (position === "current" ? "current" : "upcoming") as JourneyStepStatus,
              isAttention: position === "current" && isAttention,
              at: null,
              note: null,
            },
          ]
        }
        return phaseSteps(studentNumberSlots, position, null)
      case "registering":
        return phaseSteps(registeringSlots, position, currentIn(phase))
      case "confirmation":
        return phaseSteps(confirmationSlots, position, currentIn(phase))
    }
  }

  const phases: JourneyPhase[] = JOURNEY_PHASES.map((key) => {
    const steps = stepsOf(key).map((one) => ({ ...one, secsAfterPrevious: null, entries: [] }))
    const position = positionOf(key)
    const isFinishedConfirmation = key === "confirmation" && currentPhase === null
    return {
      key,
      steps,
      status:
        position === "current"
          ? "current"
          : steps.length > 0 && steps.every((one) => one.status === "done")
            ? "done"
            : position === "past" || isFinishedConfirmation
              ? steps.length === 0 && !isFinishedConfirmation
                ? "skipped"
                : "done"
              : "upcoming",
      current:
        position === "current"
          ? registrationStatusLines(t, newest, details.linking_schedule)
          : null,
      ending: isFinishedConfirmation && step !== "registered" ? step : null,
    }
  })
  attachDurations(phases)
  attachEntries(phases, entries)
  return phases
}
