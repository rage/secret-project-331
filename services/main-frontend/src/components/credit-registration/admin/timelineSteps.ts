import type {
  Engagement,
  TimelinePhase,
  TimelineStep,
  WaitsOn,
} from "@/generated/api/types.generated"

import type { CreditRegistrationTFunction } from "../constants"

/** Every phase a step can be in, in timeline order; `ended` holds the endings that are not ours. */
export const TIMELINE_PHASES = [
  "course",
  "student_number",
  "registering",
  "confirmation",
  "ended",
] as const satisfies readonly TimelinePhase[]

/** Each phase's steps in the order a registration reaches them. Mirrors the server's `TimelineStep::phase`. */
export const STEPS_BY_PHASE = {
  course: ["course_not_registrable_yet"],
  student_number: ["waiting_for_student_number"],
  registering: [
    "held_for_course_code",
    "looking_for_enrolment",
    "waiting_for_enrolment",
    "sending",
    "answer_unclear",
    "needs_a_person",
  ],
  confirmation: [
    "waiting_for_assessment_item",
    "waiting_for_course_unit",
    "registered",
    "recorded_wrongly",
  ],
  ended: ["already_in_sisu", "better_grade_in_sisu", "not_registering", "no_longer_registrable"],
} as const satisfies Record<TimelinePhase, readonly TimelineStep[]>

/** Every step, phase by phase. */
export const TIMELINE_STEPS: readonly TimelineStep[] = TIMELINE_PHASES.flatMap(
  (phase) => STEPS_BY_PHASE[phase],
)

/** Steps that stop until a person acts, whatever the row's Needs attention standing. */
export const ATTENTION_STEPS: ReadonlySet<TimelineStep> = new Set<TimelineStep>([
  "answer_unclear",
  "recorded_wrongly",
  "needs_a_person",
])

/** Steps counted as failed: `answer_unclear` is left out, as the server's `failed_count` does. */
export const FAILED_STEPS: readonly TimelineStep[] = ["needs_a_person", "recorded_wrongly"]

/** Steps where nothing more will happen. */
export const FINISHED_STEPS: ReadonlySet<TimelineStep> = new Set<TimelineStep>([
  "registered",
  "already_in_sisu",
  "better_grade_in_sisu",
  "not_registering",
  "no_longer_registrable",
])

/** The steps that wait on the student, the only ones a row reports its `Engagement` on. */
export const ENGAGEMENT_STEPS: ReadonlySet<TimelineStep> = new Set<TimelineStep>([
  "waiting_for_student_number",
  "waiting_for_enrolment",
])

/** The "Student activity" groups, in the order they are listed. */
export const ENGAGEMENTS = [
  "pressed",
  "visited",
  "not_started",
] as const satisfies readonly Engagement[]

const PHASE_KEYS = {
  course: "credit-registration-admin-timeline-phase-course",
  student_number: "credit-registration-admin-timeline-phase-student-number",
  registering: "credit-registration-admin-timeline-phase-registering",
  confirmation: "credit-registration-admin-timeline-phase-confirmation",
  ended: "credit-registration-admin-timeline-phase-ended",
} as const satisfies Record<TimelinePhase, string>

const STEP_KEYS = {
  course_not_registrable_yet: "credit-registration-admin-timeline-step-course-not-registrable-yet",
  waiting_for_student_number: "credit-registration-admin-timeline-step-waiting-for-student-number",
  held_for_course_code: "credit-registration-admin-timeline-step-held-for-course-code",
  looking_for_enrolment: "credit-registration-admin-timeline-step-looking-for-enrolment",
  waiting_for_enrolment: "credit-registration-admin-timeline-step-waiting-for-enrolment",
  sending: "credit-registration-admin-timeline-step-sending",
  answer_unclear: "credit-registration-admin-timeline-step-answer-unclear",
  waiting_for_assessment_item:
    "credit-registration-admin-timeline-step-waiting-for-assessment-item",
  waiting_for_course_unit: "credit-registration-admin-timeline-step-waiting-for-course-unit",
  registered: "credit-registration-admin-timeline-step-registered",
  already_in_sisu: "credit-registration-admin-timeline-step-already-in-sisu",
  better_grade_in_sisu: "credit-registration-admin-timeline-step-better-grade-in-sisu",
  recorded_wrongly: "credit-registration-admin-timeline-step-recorded-wrongly",
  needs_a_person: "credit-registration-admin-timeline-step-needs-a-person",
  not_registering: "credit-registration-admin-timeline-step-not-registering",
  no_longer_registrable: "credit-registration-admin-timeline-step-no-longer-registrable",
} as const satisfies Record<TimelineStep, string>

const ENGAGEMENT_KEYS = {
  pressed: "credit-registration-admin-engagement-pressed",
  visited: "credit-registration-admin-engagement-visited",
  not_started: "credit-registration-admin-engagement-not-started",
} as const satisfies Record<Engagement, string>

const WAITS_ON_KEYS = {
  student: "credit-registration-admin-waits-on-student",
  sisu: "credit-registration-admin-waits-on-sisu",
  support: "credit-registration-admin-waits-on-support",
  course_setup: "credit-registration-admin-waits-on-course-setup",
  nobody: "credit-registration-admin-waits-on-nobody",
} as const satisfies Record<WaitsOn, string>

/** A phase's name, as a column, subheading or filter group. */
export const timelinePhaseLabel = (t: CreditRegistrationTFunction, phase: TimelinePhase): string =>
  t(PHASE_KEYS[phase])

/** A step's plain-language label: the same words in the list, the counts and the timeline. */
export const timelineStepLabel = (t: CreditRegistrationTFunction, step: TimelineStep): string =>
  t(STEP_KEYS[step])

/** One "Student activity" group's name: Pressed, Visited or Not started. */
export const engagementLabel = (t: CreditRegistrationTFunction, engagement: Engagement): string =>
  t(ENGAGEMENT_KEYS[engagement])

/** The first line of a status: who the registration waits on. */
export const waitsOnLabel = (t: CreditRegistrationTFunction, waitsOn: WaitsOn): string =>
  t(WAITS_ON_KEYS[waitsOn])

const TIMELINE_STEP_SET: ReadonlySet<string> = new Set(TIMELINE_STEPS)
const ENGAGEMENT_SET: ReadonlySet<string> = new Set(ENGAGEMENTS)

/** Whether a query-string value names a step. */
export const isTimelineStep = (value: string): value is TimelineStep => TIMELINE_STEP_SET.has(value)

/** Whether a query-string value names a "Student activity" group. */
export const isEngagement = (value: string): value is Engagement => ENGAGEMENT_SET.has(value)
