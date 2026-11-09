import type { MyCreditRegistration, MyEnrolmentRoute } from "@/generated/api/types.generated"

import {
  canWithdrawEnrolmentConfirmation,
  detourRoute,
  isReachable,
  landingPage,
  type StepperInput,
  statusPageOf,
  stepsFor,
} from "../stepper/stepperView"

const registration = (overrides: Partial<MyCreditRegistration> = {}): MyCreditRegistration => ({
  id: "registration",
  course_id: "course",
  course_name: "Introduction to Programming",
  course_slug: "intro",
  course_module_id: "module",
  course_module_name: null,
  uh_course_code: "AYTKT10002",
  ects_credits: 5,
  completion_date: "2026-08-20T09:00:00Z",
  student_facing_status: "needs_student_number",
  registry_already_held_equal_or_better: false,
  status_is_moving: true,
  error_code: null,
  next_attempt_at: "2026-09-08T08:40:00Z",
  registered_at: null,
  sisu_attainment_id: null,
  student_number: null,
  grade_id: null,
  grade_scale_id: null,
  credits: null,
  attempt_number: 1,
  superseded: false,
  can_request_enrolment_recheck: false,
  enrolment_found: false,
  enrolment_checked_at: null,
  enrolment_realisation_name: null,
  submitted_at: null,
  is_processing_in_sisu: false,
  enrolment_link: null,
  linking_email: null,
  notification_email: null,
  progress: null,
  ...overrides,
})

const route = (overrides: Partial<MyEnrolmentRoute> = {}): MyEnrolmentRoute => ({
  course_module_completion_id: "completion",
  route: null,
  enrolment_confirmed_at: null,
  can_change: true,
  has_finnish_personal_identity_code: null,
  need: null,
  identification: null,
  need_after_reconsider: null,
  certificate_chosen_at: null,
  ...overrides,
})

const input = (overrides: Partial<StepperInput> = {}): StepperInput => ({
  registration: registration(),
  statusBeforeRegistration: "sending",
  enrolmentRoute: route(),
  hasLinkedStudentNumber: false,
  hasCertificate: true,
  hasSavedJustification: false,
  ...overrides,
})

const openUniversity = (overrides: Partial<MyEnrolmentRoute> = {}) =>
  route({ route: "open_university", has_finnish_personal_identity_code: false, ...overrides })

describe("where the answers lead", () => {
  test("a University of Helsinki student enrols in Sisu, whatever else they answered", () => {
    expect(
      detourRoute(route({ route: "university_of_helsinki", need: "certificate" }), true, false),
    ).toBe("sisu")
  })

  test("everyone else goes to the Open University when there is no certificate to offer", () => {
    expect(detourRoute(route({ route: "open_university" }), false, false)).toBe("open-university")
  })

  test("waits for each question on the way, and ignores answers under a changed one", () => {
    expect(detourRoute(route({ route: "open_university" }), true, false)).toBeNull()
    expect(
      detourRoute(
        route({
          route: "open_university",
          has_finnish_personal_identity_code: true,
          need: "certificate",
        }),
        true,
        false,
      ),
    ).toBe("open-university")
    expect(detourRoute(openUniversity({ need: "certificate" }), true, false)).toBe("certificate")
    expect(
      detourRoute(openUniversity({ need: "credits", identification: "eidas" }), true, false),
    ).toBe("open-university")
  })

  test("without Suomi.fi, credits need a saved reason first", () => {
    const answers = openUniversity({
      need: "credits",
      identification: "none",
      need_after_reconsider: "credits",
    })
    expect(detourRoute(answers, true, false)).toBeNull()
    expect(detourRoute(answers, true, true)).toBe("open-university")
    expect(detourRoute({ ...answers, need_after_reconsider: "certificate" }, true, false)).toBe(
      "certificate",
    )
  })
})

describe("which page replaces the stepper", () => {
  test("none while the student still has something to do", () => {
    expect(statusPageOf(input())).toBeNull()
    expect(statusPageOf(input({ registration: null }))).toBeNull()
  })

  test("not registering, before or after the registration exists", () => {
    expect(
      statusPageOf(input({ registration: null, statusBeforeRegistration: "not_registering" })),
    ).toBe("not-registering")
    expect(
      statusPageOf(
        input({ registration: registration({ student_facing_status: "not_registering" }) }),
      ),
    ).toBe("not-registering")
  })

  test("registering once the enrolment is found or the answer can no longer change", () => {
    expect(statusPageOf(input({ registration: registration({ enrolment_found: true }) }))).toBe(
      "registering",
    )
    expect(statusPageOf(input({ enrolmentRoute: route({ can_change: false }) }))).toBe(
      "registering",
    )
    expect(
      statusPageOf(
        input({ registration: registration({ student_facing_status: "waiting_for_sisu" }) }),
      ),
    ).toBe("registering")
  })

  test("registered, failed and course setup each get their own", () => {
    expect(
      statusPageOf(
        input({ registration: registration({ registered_at: "2026-09-01T00:00:00Z" }) }),
      ),
    ).toBe("registered")
    expect(
      statusPageOf(input({ registration: registration({ student_facing_status: "failed" }) })),
    ).toBe("failed")
    expect(
      statusPageOf(
        input({
          registration: registration({ student_facing_status: "waiting_for_course_setup" }),
        }),
      ),
    ).toBe("course-setup")
  })

  test("waiting for a linked student who said they enrolled, with or without the registration", () => {
    const confirmed = route({
      route: "university_of_helsinki",
      enrolment_confirmed_at: "2026-09-01T00:00:00Z",
    })
    expect(statusPageOf(input({ hasLinkedStudentNumber: true, enrolmentRoute: confirmed }))).toBe(
      "waiting",
    )
    expect(
      statusPageOf(
        input({ hasLinkedStudentNumber: true, enrolmentRoute: confirmed, registration: null }),
      ),
    ).toBe("waiting")
    expect(statusPageOf(input({ enrolmentRoute: confirmed }))).toBeNull()
  })
})

describe("where a returning student lands", () => {
  test("the overview before any answer, the questions while undecided", () => {
    expect(landingPage(input())).toBe("overview")
    expect(landingPage(input({ enrolmentRoute: route({ route: "open_university" }) }))).toBe(
      "questions",
    )
  })

  test("the enrolment instructions once the answers decide them", () => {
    expect(landingPage(input({ enrolmentRoute: route({ route: "university_of_helsinki" }) }))).toBe(
      "enrolment",
    )
  })

  test("linking once they said they enrolled, or the registry listed them", () => {
    expect(
      landingPage(
        input({
          enrolmentRoute: route({
            route: "university_of_helsinki",
            enrolment_confirmed_at: "2026-09-01T00:00:00Z",
          }),
        }),
      ),
    ).toBe("linking")
    expect(
      landingPage(
        input({
          registration: registration({
            linking_email: {
              email_send_status: "sent",
              emailed_to_masked: "...@example.com",
              link_state: "usable",
              sent_at: "2026-09-01T00:00:00Z",
            },
          }),
        }),
      ),
    ).toBe("linking")
  })

  test("the certificate once they chose it", () => {
    expect(
      landingPage(
        input({
          enrolmentRoute: openUniversity({
            need: "certificate",
            certificate_chosen_at: "2026-09-01T00:00:00Z",
          }),
        }),
      ),
    ).toBe("certificate")
  })
})

describe("which pages the student may open", () => {
  test("the enrolment only once the answers lead there, linking only after enrolling", () => {
    expect(isReachable("enrolment", input())).toBe(false)
    expect(
      isReachable(
        "enrolment",
        input({ enrolmentRoute: route({ route: "university_of_helsinki" }) }),
      ),
    ).toBe(true)
    expect(isReachable("linking", input())).toBe(false)
  })

  test("only linking once the registry has listed them", () => {
    const listed = input({
      registration: registration({
        linking_email: {
          email_send_status: "sent",
          emailed_to_masked: "...@example.com",
          link_state: "usable",
          sent_at: "2026-09-01T00:00:00Z",
        },
      }),
    })
    expect(isReachable("questions", listed)).toBe(false)
    expect(isReachable("linking", listed)).toBe(true)
    expect(
      canWithdrawEnrolmentConfirmation({
        ...listed,
        enrolmentRoute: route({ enrolment_confirmed_at: "2026-09-01T00:00:00Z" }),
      }),
    ).toBe(false)
  })
})

test("linking is a step only without a linked number", () => {
  expect(stepsFor(false)).toEqual(["questions", "enrolment", "linking"])
  expect(stepsFor(true)).toEqual(["questions", "enrolment"])
})
