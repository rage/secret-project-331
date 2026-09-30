import type { AdminCreditRegistrationEvent } from "@/generated/api/types.generated"

import { buildTimeline } from "../admin/timelineRows"
import type { TimelineContext, TimelineGroup } from "../admin/timelineRows"
import type { CreditRegistrationTFunction } from "../constants"

const PREFIX = "credit-registration-admin-timeline-"

// Renders each key with its interpolations appended, so the values that reach the text are visible.
const t = ((key: string, params?: Record<string, unknown>) =>
  Object.entries(params ?? {}).reduce(
    (text, [name, value]) => `${text} ${name}=${String(value)}`,
    key.replace(PREFIX, ""),
  )) as unknown as CreditRegistrationTFunction

const context: TimelineContext = {
  uhCourseCode: "TKT10001",
  selectedEnrolmentId: "otm-2",
  actorName: () => "Ada Admin",
}

const START = Date.parse("2026-09-01T10:00:00Z")
const MINUTE_MS = 60_000

/** Builds a chronological log, one minute apart, and returns it newest first as the API does. */
type EventSpec = Partial<AdminCreditRegistrationEvent> & Pick<AdminCreditRegistrationEvent, "kind">

const log = (events: EventSpec[]): AdminCreditRegistrationEvent[] =>
  events
    .map((event, index) => {
      const at = new Date(START + index * MINUTE_MS).toISOString()
      const isExchange = Boolean(event.suotar_endpoint)
      return {
        id: `event-${index}`,
        created_at: at,
        suotar_requested_at: isExchange
          ? new Date(START + index * MINUTE_MS - 2000).toISOString()
          : null,
        suotar_answered_at: isExchange ? at : null,
        ...event,
      }
    })
    .toReversed()

const summary = (groups: TimelineGroup[]) =>
  groups.map(({ rows }) => {
    const { description } = rows[0]
    return `${description.stepLabel}: ${description.result}${rows.length > 1 ? ` ×${rows.length}` : ""}`
  })

const PARTIAL =
  "Sisu has the assessment item attainment; waiting for the course unit attainment before " +
  "calling this registered."

const partialPoll = {
  kind: "suotar_response",
  suotar_endpoint: "verify_attainments",
  suotar_code: "registered",
  from_state: "awaiting_verification",
  to_state: "awaiting_verification",
  message: PARTIAL,
} as const

describe("buildTimeline", () => {
  test("reads a real registration's log as one line per step", () => {
    const groups = buildTimeline(
      t,
      log([
        { kind: "created", to_state: "pending", message: "Created for an eligible completion." },
        {
          kind: "state_changed",
          from_state: "pending",
          to_state: "no_usable_enrolment",
          message: "Waiting for the first enrolment check.",
        },
        { kind: "student_action", message: "The student said they had enrolled." },
        {
          kind: "suotar_response",
          suotar_endpoint: "resolve_persons",
          suotar_code: "personFound",
          from_state: "no_usable_enrolment",
          to_state: "no_usable_enrolment",
        },
        {
          kind: "suotar_response",
          suotar_endpoint: "resolve_enrolments",
          suotar_code: "enrolmentNotFound",
          error_code: "enrolment_not_found",
          from_state: "no_usable_enrolment",
          to_state: "no_usable_enrolment",
        },
        {
          kind: "suotar_response",
          suotar_endpoint: "resolve_enrolments",
          suotar_code: "enrolmentFound",
          from_state: "no_usable_enrolment",
          to_state: "checking_enrolment",
          details: {
            request: { courseCode: "TKT10002" },
            response: {
              result: {
                enrolments: [
                  { id: "otm-1", courseUnitRealisationName: { en: "Other" } },
                  {
                    id: "otm-2",
                    courseUnitRealisationName: { fi: "Ohjelmointi", en: "Programming" },
                    credits: { min: 5, max: 5 },
                  },
                ],
              },
            },
          },
        },
        { kind: "state_changed", from_state: "checking_enrolment", to_state: "submitting" },
        {
          kind: "suotar_response",
          suotar_endpoint: "import_attainments",
          suotar_code: "sent",
          from_state: "submitting",
          to_state: "awaiting_verification",
        },
        ...Array.from({ length: 7 }, () => partialPoll),
      ]),
      context,
    )

    expect(summary(groups)).toEqual([
      "step-created: result-created",
      "step-pipeline: Waiting for the first enrolment check.",
      "step-student: The student said they had enrolled.",
      "step-student-lookup: result-person-found",
      "step-enrolment-check-code courseCode=TKT10001: result-no-enrolment-yet",
      "step-enrolment-check-code courseCode=TKT10002: result-enrolment-found",
      "step-submission: result-sent",
      "step-registration-check: result-partly-registered ×7",
    ])

    const [created, , student, person, , found, sent, polls] = groups
    expect(created?.rows[0].description.detail).toBe("Created for an eligible completion.")
    expect(created?.rows[0].changedState).toBe(true)
    expect(student?.rows[0].description.detail).toBeNull()
    expect(person?.rows[0].changedState).toBe(false)
    expect(person?.rows[0].duration).toBe("duration-seconds seconds=2")
    expect(found?.rows[0].description.detail).toBe(
      "Programming · credit-registration-credits credits=5",
    )
    expect(found?.rows[0].description.tone).toBe("done")
    expect(sent?.rows[0].changedState).toBe(true)
    expect(polls?.rows[0].description.detail).toBe(PARTIAL)
    expect(polls?.rows[0].description.tone).toBe("current")
  })

  test("keeps a claim nothing answered, which is how a hung row shows", () => {
    const groups = buildTimeline(
      t,
      log([{ kind: "state_changed", from_state: "checking_enrolment", to_state: "submitting" }]),
      context,
    )
    expect(summary(groups)).toEqual(["step-pipeline: result-picked-up"])
  })

  test("reads a whole-request refusal as refused, with our reason under it", () => {
    const groups = buildTimeline(
      t,
      log([
        {
          kind: "suotar_response",
          suotar_endpoint: "import_attainments",
          from_state: "submitting",
          to_state: "failed_retryable",
          error_code: "malformed_request",
          suotar_answer: "refused",
          message: "Sisu did not accept the whole request.",
        },
        {
          kind: "suotar_response",
          suotar_endpoint: "verify_attainments",
          from_state: "awaiting_verification",
          to_state: "awaiting_verification",
          suotar_answer: "unanswered",
          message: "Sisu did not answer for this item.",
        },
      ]),
      context,
    )
    expect(summary(groups)).toEqual([
      "step-submission: result-request-refused",
      "step-registration-check: result-no-answer",
    ])
    const refusal = groups[0]?.rows[0].description
    expect(refusal?.tone).toBe("failed")
    expect(refusal?.detail).toBe("Sisu did not accept the whole request.")
    expect(refusal?.resultNamesError).toBe(false)
  })

  test("reads an enrolment lookup after an uncertain submission as a credit search", () => {
    const groups = buildTimeline(
      t,
      log([
        {
          kind: "suotar_response",
          suotar_endpoint: "resolve_enrolments",
          suotar_code: "enrolmentFound",
          from_state: "submission_uncertain",
          to_state: "submission_uncertain",
        },
        {
          kind: "suotar_response",
          suotar_endpoint: "resolve_enrolments",
          suotar_code: "enrolmentFound",
          from_state: "submission_uncertain",
          to_state: "duplicate",
        },
      ]),
      context,
    )
    expect(summary(groups)).toEqual([
      "step-credit-search: result-credits-not-found-yet",
      "step-credit-search: result-credits-in-sisu",
    ])
  })

  test("numbers the resend after Sisu lost the first submission", () => {
    const groups = buildTimeline(
      t,
      log([
        { kind: "state_changed", from_state: "checking_enrolment", to_state: "submitting" },
        {
          kind: "suotar_response",
          suotar_endpoint: "import_attainments",
          suotar_code: "sent",
          from_state: "submitting",
          to_state: "awaiting_verification",
        },
        {
          kind: "suotar_response",
          suotar_endpoint: "verify_attainments",
          suotar_code: "notRegistered",
          error_code: "not_registered",
          from_state: "awaiting_verification",
          to_state: "failed_retryable",
        },
        { kind: "state_changed", from_state: "failed_retryable", to_state: "ready_to_submit" },
        { kind: "state_changed", from_state: "ready_to_submit", to_state: "resolving_enrolment" },
        {
          kind: "suotar_response",
          suotar_endpoint: "resolve_enrolments",
          suotar_code: "enrolmentFound",
          from_state: "resolving_enrolment",
          to_state: "checking_enrolment",
        },
        { kind: "state_changed", from_state: "checking_enrolment", to_state: "submitting" },
        {
          kind: "suotar_response",
          suotar_endpoint: "import_attainments",
          suotar_code: "sent",
          from_state: "submitting",
          to_state: "awaiting_verification",
        },
      ]),
      { ...context, uhCourseCode: null },
    )
    expect(summary(groups)).toEqual([
      "step-submission: result-sent",
      "step-registration-check: result-no-record-resending",
      "step-pipeline: result-resumed",
      "step-enrolment-check: result-enrolment-found",
      "step-submission-n n=2: result-sent",
    ])
    expect(groups[1]?.rows[0].description.tone).toBe("action-needed")
  })

  test("never hides or merges a row an admin acted on", () => {
    const claim = {
      kind: "state_changed",
      from_state: "checking_enrolment",
      to_state: "submitting",
      actor_user_id: "admin-1",
    } as const
    const groups = buildTimeline(
      t,
      log([
        claim,
        {
          kind: "suotar_response",
          suotar_endpoint: "import_attainments",
          suotar_code: "sent",
          from_state: "submitting",
          to_state: "awaiting_verification",
        },
        { kind: "admin_action", actor_user_id: "admin-1", message: "Checked by hand" },
      ]),
      context,
    )
    expect(summary(groups)).toEqual([
      "step-pipeline: result-picked-up",
      "step-submission: result-sent",
      "step-admin: result-admin actor=Ada Admin reason=Checked by hand",
    ])
  })
})
