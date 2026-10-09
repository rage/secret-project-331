import type { AdminCreditRegistrationEvent } from "@/generated/api/types.generated"

import { buildTimeline } from "../admin/timelineRows"
import type { TimelineContext, TimelineEntry } from "../admin/timelineRows"
import type { CreditRegistrationTFunction } from "../constants"

const PREFIX = "credit-registration-admin-timeline-"

// Renders each key with its interpolations appended, so the values that reach the text are visible.
const t = ((key: string, params?: Record<string, unknown>) =>
  Object.entries(params ?? {}).reduce(
    (text, [name, value]) => `${text} ${name}=${String(value)}`,
    key.replace(PREFIX, ""),
  )) as unknown as CreditRegistrationTFunction

const context: TimelineContext = {
  actorName: () => "Ada Admin",
  selectedEnrolmentId: "enrolment-2",
  language: "en",
  attemptNumber: () => 1,
}

const START = Date.parse("2026-09-01T10:00:00Z")
const MINUTE_MS = 60_000

type EventSpec = Partial<AdminCreditRegistrationEvent> & Pick<AdminCreditRegistrationEvent, "kind">

/** Builds a chronological log, one minute apart, oldest first as the API returns it. */
const log = (events: EventSpec[]): AdminCreditRegistrationEvent[] =>
  events.map((event, index) => {
    const at = new Date(START + index * MINUTE_MS).toISOString()
    const isExchange = Boolean(event.suotar_endpoint)
    return {
      id: `event-${index}`,
      credit_registration_id: "registration-1",
      created_at: at,
      suotar_requested_at: isExchange
        ? new Date(START + index * MINUTE_MS - 2000).toISOString()
        : null,
      suotar_answered_at: isExchange ? at : null,
      ...event,
    }
  })

const sentences = (entries: TimelineEntry[]) => entries.map((entry) => entry.sentence)

const noEnrolment = {
  kind: "suotar_response",
  suotar_endpoint: "resolve_enrolments",
  suotar_code: "enrolmentNotFound",
  suotar_answer: "answered",
  error_code: "enrolment_not_found",
  from_state: "no_usable_enrolment",
  to_state: "no_usable_enrolment",
} as const

const partialPoll = {
  kind: "suotar_response",
  suotar_endpoint: "verify_attainments",
  suotar_code: "registered",
  suotar_answer: "answered",
  from_state: "partially_registered",
  to_state: "partially_registered",
} as const

describe("buildTimeline", () => {
  test("tells a real registration's story as milestones, folding repeated checks", () => {
    const entries = buildTimeline(
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
        noEnrolment,
        {
          kind: "state_changed",
          from_state: "no_usable_enrolment",
          to_state: "no_usable_enrolment",
        },
        noEnrolment,
        noEnrolment,
        {
          kind: "suotar_response",
          suotar_endpoint: "resolve_enrolments",
          suotar_code: "enrolmentFound",
          from_state: "no_usable_enrolment",
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
        { ...partialPoll, from_state: "awaiting_verification" },
        ...Array.from({ length: 6 }, () => partialPoll),
      ]),
      context,
    )

    expect(sentences(entries)).toEqual([
      "Waiting for the first enrolment check.",
      "The student said they had enrolled.",
      "checked-enrolment-none count=3",
      "result-enrolment-found",
      "result-sent",
      "result-partly-registered",
      "waited-for-confirmation count=6",
    ])
    expect(entries[0]?.tone).toBe("current")
    expect(entries[0]?.state).toBe("no_usable_enrolment")
    expect(entries[2]?.state).toBeNull()
    const checks = entries[2]
    expect(checks?.at).toBe(new Date(START + 4 * MINUTE_MS).toISOString())
    expect(checks?.until).toBe(new Date(START + 7 * MINUTE_MS).toISOString())
    expect(entries[3]?.until).toBeNull()
    expect(entries[3]?.tone).toBe("done")
  })

  test("keeps an unlinked student number, which changes what happens next", () => {
    const entries = buildTimeline(
      t,
      log([
        {
          kind: "suotar_response",
          suotar_endpoint: "resolve_persons",
          suotar_code: "personNotFound",
          from_state: "pending",
          to_state: "pending",
        },
        { kind: "retry_scheduled", message: "Held back." },
      ]),
      context,
    )
    expect(sentences(entries)).toEqual(["result-person-not-found", "result-held-back"])
    expect(entries[0]?.tone).toBe("action-needed")
  })

  test("reads a refusal and a missing answer as such, folding repeats of either", () => {
    const unanswered = {
      kind: "suotar_response",
      suotar_endpoint: "verify_attainments",
      from_state: "awaiting_verification",
      to_state: "awaiting_verification",
      suotar_answer: "unanswered",
    } as const
    const entries = buildTimeline(
      t,
      log([
        {
          kind: "suotar_response",
          suotar_endpoint: "import_attainments",
          from_state: "submitting",
          to_state: "failed_retryable",
          error_code: "malformed_request",
          suotar_answer: "refused",
        },
        unanswered,
        unanswered,
      ]),
      context,
    )
    expect(sentences(entries)).toEqual([
      "result-request-refused",
      "repeated sentence=result-no-answer count=2",
    ])
    expect(entries[0]?.tone).toBe("failed")
  })

  test("reads an enrolment lookup after an uncertain submission as a credit search", () => {
    const search = {
      kind: "suotar_response",
      suotar_endpoint: "resolve_enrolments",
      suotar_code: "enrolmentFound",
      from_state: "submission_uncertain",
      to_state: "submission_uncertain",
    } as const
    const entries = buildTimeline(
      t,
      log([search, search, { ...search, to_state: "duplicate" }]),
      context,
    )
    expect(sentences(entries)).toEqual([
      "checked-credits-not-found count=2",
      "result-credits-in-sisu",
    ])
  })

  test("names the admin and their reason, and never folds or drops what they did", () => {
    const entries = buildTimeline(
      t,
      log([
        {
          kind: "state_changed",
          from_state: "checking_enrolment",
          to_state: "submitting",
          actor_user_id: "admin-1",
        },
        {
          kind: "admin_action",
          actor_user_id: "admin-1",
          from_state: "failed_permanent",
          to_state: "ready_to_submit",
          message: "Student asked",
        },
        { kind: "admin_action", actor_user_id: "admin-1", message: "Checked by hand" },
        { kind: "admin_action", actor_user_id: "admin-1", message: "Checked by hand" },
        { kind: "cancelled", actor_user_id: "admin-1", to_state: "cancelled" },
      ]),
      context,
    )
    expect(sentences(entries)).toEqual([
      "by-actor action=moved-to state=credit-registration-admin-ledger-state-submitting actor=Ada Admin",
      "by-actor action=moved-to state=credit-registration-ledger-state-ready-to-submit actor=Ada Admin",
      "by-actor action=credit-registration-admin-event-admin-action actor=Ada Admin",
      "by-actor action=credit-registration-admin-event-admin-action actor=Ada Admin",
      "by-actor action=credit-registration-ledger-state-cancelled actor=Ada Admin",
    ])
    expect(entries.map((entry) => entry.detail)).toEqual([
      null,
      "Student asked",
      "Checked by hand",
      "Checked by hand",
      null,
    ])
  })

  test("gives a rejection Sisu's code and what it means, and a found enrolment its name", () => {
    const entries = buildTimeline(
      t,
      log([
        {
          kind: "suotar_response",
          suotar_endpoint: "resolve_enrolments",
          suotar_code: "enrolmentFound",
          from_state: "no_usable_enrolment",
          to_state: "checking_enrolment",
          details: {
            response: {
              result: {
                enrolments: [
                  { id: "enrolment-1", courseUnitRealisationName: { en: "Spring" } },
                  {
                    id: "enrolment-2",
                    courseUnitRealisationName: { fi: "Syksy" },
                    credits: { min: 5, max: 5 },
                  },
                ],
              },
            },
          },
        },
        {
          kind: "suotar_response",
          suotar_endpoint: "import_attainments",
          suotar_code: "sisuValidationFailed",
          suotar_answer: "answered",
          error_code: "sisu_validation_failed",
          from_state: "submitting",
          to_state: "failed_permanent",
        },
      ]),
      context,
    )
    expect(sentences(entries)).toEqual(["result-enrolment-found", "result-rejected"])
    expect(entries.map((entry) => entry.detail)).toEqual([
      "Syksy, credit-registration-credits credits=5",
      expect.stringMatching(
        /^credit-registration-admin-rejection-detail .*credit-registration-admin-error-sisu-validation-failed.*sisuValidationFailed/,
      ),
    ])
    expect(entries.map((entry) => entry.state)).toEqual(["checking_enrolment", "failed_permanent"])
    expect(entries[1]?.tone).toBe("failed")
  })

  test("names no enrolment when several came back and none is the selected one", () => {
    const entries = buildTimeline(
      t,
      log([
        {
          kind: "suotar_response",
          suotar_endpoint: "resolve_enrolments",
          suotar_code: "enrolmentFound",
          from_state: "no_usable_enrolment",
          to_state: "checking_enrolment",
          details: {
            response: {
              result: {
                enrolments: [
                  { id: "enrolment-1", courseUnitRealisationName: { en: "Spring" } },
                  { id: "enrolment-3", courseUnitRealisationName: { en: "Autumn" } },
                ],
              },
            },
          },
        },
      ]),
      context,
    )
    expect(entries[0]?.detail).toBeNull()
  })

  test("drops silent claims and resumes", () => {
    const entries = buildTimeline(
      t,
      log([
        { kind: "state_changed", from_state: "checking_enrolment", to_state: "submitting" },
        { kind: "state_changed", from_state: "failed_retryable", to_state: "ready_to_submit" },
      ]),
      context,
    )
    expect(entries).toEqual([])
  })
})
