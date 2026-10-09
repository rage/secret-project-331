import type {
  AdminCreditRegistrationRow,
  AdminLinkingSchedule,
} from "@/generated/api/types.generated"

import type { CreditRegistrationTFunction } from "../constants"
import { formatZonedTimestamp } from "../ZonedTimestamp"
import { attentionReasonLabel, registrationErrorAdminHelp } from "./adminCreditRegistrationCopy"
import { ATTENTION_STEPS, FINISHED_STEPS, waitsOnLabel } from "./timelineSteps"

export type RegistrationStatusTone = "neutral" | "attention" | "done"

/** A registration's status in two lines: who it waits on, then what happens next. */
export interface RegistrationStatusLines {
  waitsOn: string
  next: string | null
  tone: RegistrationStatusTone
  /** Its actions live on the Needs attention tab. */
  isHandledInNeedsAttention: boolean
}

export type RegistrationStatusSubject = Pick<
  AdminCreditRegistrationRow,
  | "timeline_step"
  | "waits_on"
  | "engagement"
  | "state"
  | "error_code"
  | "next_attempt_at"
  | "enrolment_check_due_at"
  | "enrolment_checks_stopped_at"
  | "registered_at"
  | "attention_standing"
  | "attention_reasons"
  | "uh_course_code"
  | "verified_student_number"
  | "student_number"
>

const at = (time: string): string => formatZonedTimestamp(new Date(time))

const nextSisuCheck = (t: CreditRegistrationTFunction, time: string | null | undefined) =>
  time ? t("credit-registration-admin-status-next-sisu-check", { time: at(time) }) : null

const linkingNext = (
  t: CreditRegistrationTFunction,
  schedule: AdminLinkingSchedule | null | undefined,
): string => {
  if (!schedule) {
    return t("credit-registration-admin-status-waiting-for-linking-email")
  }
  if (schedule.is_enrolment_list_empty) {
    return t("credit-registration-admin-status-enrolment-list-empty")
  }
  if (schedule.linking_emails_since_press > 0) {
    return t("credit-registration-admin-status-linking-email-went-out")
  }
  return t("credit-registration-admin-status-next-enrolment-list-fetch", {
    time: at(schedule.next_fetch_at),
  })
}

const stepNext = (
  t: CreditRegistrationTFunction,
  row: RegistrationStatusSubject,
  schedule: AdminLinkingSchedule | null | undefined,
): string | null => {
  switch (row.timeline_step) {
    case "course_not_registrable_yet":
      return t("credit-registration-admin-status-course-not-registrable-yet")
    case "waiting_for_student_number":
      switch (row.engagement) {
        case "pressed":
          return linkingNext(t, schedule)
        case "visited":
          return t("credit-registration-admin-status-until-pressed")
        default:
          return t("credit-registration-admin-status-until-visited")
      }
    case "held_for_course_code":
      return t("credit-registration-admin-status-held-for-course-code")
    case "looking_for_enrolment":
      return nextSisuCheck(t, row.next_attempt_at)
    case "waiting_for_enrolment":
      if (row.engagement === "not_started") {
        return t("credit-registration-admin-status-until-visited")
      }
      if (row.enrolment_checks_stopped_at) {
        return t("credit-registration-admin-status-enrolment-checks-stopped", {
          time: at(row.enrolment_checks_stopped_at),
        })
      }
      return nextSisuCheck(t, row.enrolment_check_due_at)
    case "sending":
      return t("credit-registration-admin-status-next-attempt", { time: at(row.next_attempt_at) })
    case "answer_unclear":
      return t("credit-registration-admin-status-answer-unclear")
    case "waiting_for_assessment_item":
    case "waiting_for_course_unit":
      return nextSisuCheck(t, row.next_attempt_at)
    case "registered":
      return row.registered_at
        ? t("credit-registration-admin-status-registered", { time: at(row.registered_at) })
        : null
    case "already_in_sisu":
      return t("credit-registration-admin-status-already-in-sisu")
    case "better_grade_in_sisu":
      return t("credit-registration-admin-status-better-grade-in-sisu")
    case "recorded_wrongly":
      return t("credit-registration-admin-status-recorded-wrongly")
    case "needs_a_person":
      return (
        registrationErrorAdminHelp(t, row.error_code, {
          studentNumber: row.verified_student_number ?? row.student_number ?? null,
          courseCode: row.uh_course_code ?? null,
        }) ?? t("credit-registration-admin-status-needs-a-person")
      )
    case "not_registering":
      return t("credit-registration-admin-status-not-registering")
    case "no_longer_registrable":
      return t("credit-registration-admin-status-no-longer-registrable")
  }
}

/**
 * The two-line status the registration page's status card and the Needs attention rows share.
 *
 * `schedule` is the course code's linking schedule, which only a student who pressed "I have
 * enrolled" and has no linked number has.
 */
export const registrationStatusLines = (
  t: CreditRegistrationTFunction,
  row: RegistrationStatusSubject,
  schedule?: AdminLinkingSchedule | null,
): RegistrationStatusLines => {
  const needsAttention = row.attention_standing === "needs_attention"
  const isStuckPresser = needsAttention && row.attention_reasons.includes("student_number_stuck")
  const waitsOn = waitsOnLabel(t, row.waits_on)
  if (isStuckPresser) {
    return {
      waitsOn,
      next: t("credit-registration-admin-status-student-number-stuck"),
      tone: "attention",
      isHandledInNeedsAttention: true,
    }
  }
  const next = stepNext(t, row, schedule)
  // The step's own wording already says what went wrong on an attention step.
  const reasons =
    needsAttention && !ATTENTION_STEPS.has(row.timeline_step)
      ? row.attention_reasons.map((reason) => attentionReasonLabel(t, reason))
      : []
  const lead =
    row.attention_standing === "running_late"
      ? [t("credit-registration-admin-status-running-late")]
      : reasons.map((reason) => t("credit-registration-admin-status-reason", { reason }))
  return {
    waitsOn,
    next: [...lead, next].filter((part): part is string => Boolean(part)).join(" ") || null,
    tone:
      needsAttention || ATTENTION_STEPS.has(row.timeline_step)
        ? "attention"
        : FINISHED_STEPS.has(row.timeline_step)
          ? "done"
          : "neutral",
    isHandledInNeedsAttention: false,
  }
}
