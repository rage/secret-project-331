import type React from "react"

import type {
  AdminCreditRegistrationDetails,
  AdminCreditRegistrationEvent,
  AdminCreditRegistrationRow,
  CreditRegistrationNotificationKind,
  CreditRegistrationState,
  StudentNumberVerificationMethod,
  TimelineStep,
} from "@/generated/api/types.generated"

import type { CreditRegistrationTFunction } from "../constants"
import { sentenceWithEmailAddress } from "../EmailAddress"
import { sentenceWithTimestamp } from "../ZonedTimestamp"
import { adminErrorShortLabel } from "./adminCreditRegistrationCopy"
import { registrationStatusLines } from "./registrationStatus"
import type { TimelineEntry } from "./timelineRows"
import { ENGAGEMENT_STEPS, FINISHED_STEPS, timelineStepLabel } from "./timelineSteps"

/** A column of the registration page's timeline; Starting registration is a column only there. */
export type JourneyPhaseKey =
  | "course"
  | "starting_registration"
  | "student_number"
  | "registering"
  | "confirmation"

/** `attention` is a substep stopped until a person acts. */
export type JourneySubstepStatus = "done" | "current" | "attention" | "upcoming"

/** One checklist line under a phase. */
export interface JourneySubstep {
  key: string
  label: string
  status: JourneySubstepStatus
  at: string | null
  /** Seconds since the substep before it; null for the first one or one that came earlier. */
  secsAfterPrevious: number | null
  /** One more fact about the substep, such as how they enrolled or what happens next. */
  detail: React.ReactNode
  /** The events that led up to the substep, or, for the current one, everything since. */
  entries: TimelineEntry[]
}

/**
 * A skipped phase is one the registration passed without any of its substeps happening; `attention`
 * is the current phase when it waits for a person.
 */
export type JourneyPhaseStatus = "done" | "current" | "attention" | "upcoming" | "skipped"

/** What stopped an `attention` phase, worded for the box under the timeline. */
export interface JourneyProblem {
  /** Who it waits on, e.g. "Waiting for support". */
  waitsOn: string
  /** When it stopped. */
  since: string
  /** What is wrong, as facts. */
  summary: React.ReactNode
  /** A possible cause, worded as one. */
  hint: string | null
  /** Stuck on a student number that never got linked, which has its own actions. */
  isStudentNumberStuck: boolean
}

/** One of the timeline's numbered steps, as admins see it, with its substeps. */
export interface JourneyPhase {
  key: JourneyPhaseKey
  status: JourneyPhaseStatus
  substeps: JourneySubstep[]
  problem: JourneyProblem | null
  /** How the registration ended, on the Confirmation phase of a finished one. */
  ending: TimelineStep | null
}

/** `aria-current` for a phase or substep: set on the one the registration is at. */
export const ariaCurrent = (status: JourneyPhaseStatus): "step" | undefined =>
  status === "current" || status === "attention" ? "step" : undefined

/** The columns, left to right. */
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

const changedState = (event: Event): boolean =>
  Boolean(event.to_state) && event.from_state !== event.to_state

const firstReaching = (
  events: Event[],
  states: ReadonlySet<CreditRegistrationState>,
): string | null =>
  events.find((event) => changedState(event) && event.to_state && states.has(event.to_state))
    ?.created_at ?? null

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
  detail?: React.ReactNode
}

type SubstepDraft = Omit<JourneySubstep, "secsAfterPrevious" | "entries">

const toSubstep = (slot: Slot): SubstepDraft => ({
  key: slot.key,
  label: slot.label,
  status: slot.at === null ? "upcoming" : "done",
  at: slot.at,
  detail: slot.at === null ? null : (slot.detail ?? null),
})

/** The newest attempt's own substep, standing in for the slot it `replaces`, or added if none. */
interface CurrentSubstep {
  label: string
  status: "current" | "attention"
  detail: React.ReactNode
  replaces: string | null
}

/**
 * One phase's substeps: the slots that happened as done, the current one in its slot's place (or
 * after the done ones), the rest as upcoming. In a phase the row has left, slots that never
 * happened are left out.
 */
const phaseSubsteps = (
  slots: Slot[],
  position: "past" | "current" | "future",
  current: CurrentSubstep | null,
): SubstepDraft[] => {
  if (position === "past") {
    return slots.filter((slot) => slot.at !== null).map((slot) => toSubstep(slot))
  }
  if (position === "future" || current === null) {
    return slots.map((slot) => toSubstep(slot))
  }
  const substeps: SubstepDraft[] = []
  let isPlaced = false
  const place = (at: string | null) => {
    substeps.push({
      key: current.replaces ?? "current",
      label: current.label,
      status: current.status,
      // A rejected send keeps its time; a substep still under way has none yet.
      at,
      detail: current.detail,
    })
    isPlaced = true
  }
  for (const slot of slots) {
    if (slot.key === current.replaces) {
      place(slot.at)
      continue
    }
    if (slot.at === null && !isPlaced && current.replaces === null) {
      place(null)
    }
    substeps.push(toSubstep(slot))
  }
  if (!isPlaced) {
    place(null)
  }
  return substeps
}

/** The slot a current timeline step in Registering or Confirmation stands in for, and its phase. */
const REPLACED_SLOT: Partial<Record<TimelineStep, { slot: string; phase: JourneyPhaseKey }>> = {
  looking_for_enrolment: { slot: "enrolment_found", phase: "registering" },
  waiting_for_enrolment: { slot: "enrolment_found", phase: "registering" },
  sending: { slot: "sent", phase: "registering" },
  answer_unclear: { slot: "accepted", phase: "registering" },
  waiting_for_assessment_item: { slot: "assessment_item", phase: "confirmation" },
  waiting_for_course_unit: { slot: "course_unit", phase: "confirmation" },
}

/** The phase a timeline step with no slot of its own is shown in, as an extra current substep. */
const INSERTED_IN: Partial<Record<TimelineStep, JourneyPhaseKey>> = {
  course_not_registrable_yet: "course",
  held_for_course_code: "registering",
  recorded_wrongly: "confirmation",
}

/**
 * Hands each event entry to the timed substep it led up to, and what came after the last one to the
 * current substep, so expanding a substep shows how it got there.
 */
const attachEntries = (phases: JourneyPhase[], entries: TimelineEntry[]) => {
  const substeps = phases.flatMap((phase) => phase.substeps)
  const timed = substeps
    .flatMap((substep) =>
      substep.at !== null && (substep.status === "done" || substep.status === "attention")
        ? [{ substep, at: Date.parse(substep.at) }]
        : [],
    )
    .toSorted((a, b) => a.at - b.at)
  const tail =
    substeps.find((substep) => substep.status === "current" || substep.status === "attention") ??
    timed.at(-1)?.substep
  for (const entry of entries) {
    const owner = timed.find(({ at }) => at >= Date.parse(entry.at))?.substep ?? tail
    owner?.entries.push(entry)
  }
}

/** Fills in each timed substep's distance from the one before it, in reading order. */
const attachDurations = (phases: JourneyPhase[]) => {
  let previous: number | null = null
  for (const substep of phases.flatMap((phase) => phase.substeps)) {
    if (substep.at === null) {
      continue
    }
    const at = Date.parse(substep.at)
    if (previous !== null && at >= previous) {
      substep.secsAfterPrevious = (at - previous) / 1000
    }
    previous = previous === null ? at : Math.max(previous, at)
  }
}

/**
 * A phase's status from its position. A finished registration has no current phase, so its
 * Confirmation is `past`, and done even with no substeps.
 */
const phaseStatusOf = (
  position: "past" | "current" | "future",
  substeps: SubstepDraft[],
  isAttention: boolean,
  isFinishedConfirmation: boolean,
): JourneyPhaseStatus => {
  switch (position) {
    case "current":
      return isAttention ? "attention" : "current"
    case "past":
      return substeps.length > 0 || isFinishedConfirmation ? "done" : "skipped"
    case "future":
      return substeps.length > 0 && substeps.every((one) => one.status === "done")
        ? "done"
        : "upcoming"
  }
}

const LINKED_VIA_KEYS = {
  emailed_link: "credit-registration-admin-journey-linked-via-emailed-link",
  admin_manual: "credit-registration-admin-journey-linked-via-admin-manual",
  study_registry: "credit-registration-admin-journey-linked-via-study-registry",
} as const satisfies Record<StudentNumberVerificationMethod, string>

/**
 * The whole completion's story as phases, whichever attempt's page is open: the newest attempt
 * decides where it stands, and every attempt's events are in it.
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
  const timelineStep = newest.timeline_step
  const currentPhase = currentPhaseOf(newest)
  const currentIndex =
    currentPhase === null ? JOURNEY_PHASES.length : JOURNEY_PHASES.indexOf(currentPhase)
  const positionOf = (phase: JourneyPhaseKey): "past" | "current" | "future" => {
    const index = JOURNEY_PHASES.indexOf(phase)
    return index < currentIndex ? "past" : index === currentIndex ? "current" : "future"
  }
  const status = registrationStatusLines(
    t,
    newest,
    details.linking_schedule,
    details.linking_schedule?.unlinked_enrolled_before_count,
  )
  const isAttention = status.tone === "attention"
  const currentSubstep = (replaces: string | null): CurrentSubstep => ({
    label: timelineStepLabel(t, timelineStep),
    status: isAttention ? "attention" : "current",
    // An attention substep's story is told in the problem box.
    detail: isAttention ? null : status.next,
    replaces,
  })

  const mailSentAt = (kind: CreditRegistrationNotificationKind): string | null =>
    details.notification_emails.find((mail) => mail.kind === kind)?.send_status.sent_at ?? null

  const pleaseRegisterSentAt = mailSentAt("action_needed")
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
    ...(pleaseRegisterSentAt
      ? [
          {
            key: "please_register_sent",
            label: t("credit-registration-admin-journey-please-register-sent"),
            at: pleaseRegisterSentAt,
          },
        ]
      : []),
  ]

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
      detail: journey.enrolment_route
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
  const linkedVia = newest.verified_student_number_via ?? null
  const isReturning = linkedAt !== null && Date.parse(linkedAt) < firstCreatedAt
  const usedLinkingEmail =
    linkedVia === "emailed_link"
      ? details.linking_emails.find(
          (mail) => mail.token_used_at && mail.token_claimed_by_user_id === newest.user_id,
        )
      : undefined
  const studentNumberSlots: Slot[] = isReturning
    ? [
        {
          key: "already_known",
          label: t("credit-registration-admin-journey-already-known"),
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
                detail: sentenceWithEmailAddress(
                  t,
                  "credit-registration-admin-journey-emailed-to",
                  usedLinkingEmail.emailed_to,
                ),
              },
            ]
          : []),
        {
          key: "linked",
          label: t("credit-registration-admin-journey-linked"),
          at: linkedAt,
          detail: linkedVia ? t(LINKED_VIA_KEYS[linkedVia]) : null,
        },
      ].filter((slot) => slot.at !== null)

  const enrolmentFoundAt = firstReaching(newestEvents, ENROLMENT_FOUND_STATES)
  const sendCount = newestEvents.filter(
    (event) => event.suotar_endpoint === "import_attainments",
  ).length
  const registeringSlots: Slot[] = [
    {
      key: "enrolment_found",
      label: t("credit-registration-admin-journey-enrolment-found"),
      at: enrolmentFoundAt,
      detail:
        enrolmentFoundAt && journey.sisu_enrolled_at
          ? sentenceWithTimestamp(
              t,
              "credit-registration-admin-journey-sisu-enrolment-time",
              journey.sisu_enrolled_at,
            )
          : null,
    },
    {
      key: "sent",
      label: t("credit-registration-admin-journey-sent"),
      at: newest.submitted_at ?? firstSent(newestEvents),
      detail:
        sendCount > 1 ? t("credit-registration-admin-journey-tries", { count: sendCount }) : null,
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
    {
      key: "registered_email_sent",
      label: t("credit-registration-admin-journey-registered-email-sent"),
      at: mailSentAt("registered"),
    },
  ]

  const currentIn = (phase: JourneyPhaseKey): CurrentSubstep | null => {
    if (timelineStep === "needs_a_person") {
      if (phase !== "registering") {
        return null
      }
      // Stopped at the Registering substep that went wrong; a rejected send keeps its own name.
      const pending = registeringSlots.find((slot) => slot.at === null)
      const failed =
        pending?.key === "accepted" ? registeringSlots.find((slot) => slot.key === "sent") : pending
      return failed
        ? {
            label: failed.label,
            status: "attention",
            detail: adminErrorShortLabel(t, newest.error_code),
            replaces: failed.key,
          }
        : currentSubstep(null)
    }
    if (INSERTED_IN[timelineStep] === phase) {
      return currentSubstep(null)
    }
    const replaced = REPLACED_SLOT[timelineStep]
    return replaced?.phase === phase ? currentSubstep(replaced.slot) : null
  }

  const substepsOf = (phase: JourneyPhaseKey): SubstepDraft[] => {
    const position = positionOf(phase)
    switch (phase) {
      case "course":
        return phaseSubsteps(courseSlots, position, currentIn(phase))
      case "starting_registration": {
        if (position !== "current") {
          return phaseSubsteps(startingSlots, position, null)
        }
        // What the student does next is the current substep; there is no timeline step for it.
        const nextIndex = startingSlots.findIndex((slot) => slot.at === null)
        return startingSlots.map((slot, index) =>
          index === nextIndex
            ? { ...currentSubstep(null), key: slot.key, label: slot.label, at: null }
            : toSubstep(slot),
        )
      }
      case "student_number": {
        if (linkedAt !== null) {
          return phaseSubsteps(studentNumberSlots, position, null)
        }
        // Until they link, we do not know who they are in Sisu, so nothing more can be said.
        const notLinked = { ...currentSubstep(null), key: "not_linked", at: null }
        return [
          position === "current"
            ? notLinked
            : {
                ...notLinked,
                label: timelineStepLabel(t, "waiting_for_student_number"),
                status: "upcoming",
                detail: null,
              },
        ]
      }
      case "registering":
        return phaseSubsteps(registeringSlots, position, currentIn(phase))
      case "confirmation":
        return phaseSubsteps(confirmationSlots, position, currentIn(phase))
    }
  }

  const problem = (): JourneyProblem => {
    const isStudentNumberStuck = newest.attention_reasons.includes("student_number_stuck")
    // The stuck rule counts from the fetch that should have sent a linking email.
    const stoppedAt = isStudentNumberStuck
      ? details.linking_schedule?.last_mailing_fetch_started_at
      : newestEvents.findLast((event) => changedState(event) && event.to_state === newest.state)
          ?.created_at
    return {
      waitsOn: status.waitsOn,
      since: stoppedAt ?? newest.phase_started_at,
      summary: status.next,
      hint: status.hint,
      isStudentNumberStuck,
    }
  }

  const phases: JourneyPhase[] = JOURNEY_PHASES.map((key) => {
    const substeps = substepsOf(key).map((one) => ({
      ...one,
      secsAfterPrevious: null,
      entries: [],
    }))
    const position = positionOf(key)
    const isFinishedConfirmation = key === "confirmation" && currentPhase === null
    return {
      key,
      substeps,
      status: phaseStatusOf(position, substeps, isAttention, isFinishedConfirmation),
      problem: position === "current" && isAttention ? problem() : null,
      ending: isFinishedConfirmation ? timelineStep : null,
    }
  })
  attachDurations(phases)
  attachEntries(phases, entries)
  return phases
}
