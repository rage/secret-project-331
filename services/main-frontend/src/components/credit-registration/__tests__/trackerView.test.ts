import type { MyCreditRegistration, MyEnrolmentRoute } from "@/generated/api/types.generated"

import {
  asksWhereYouEnrolled,
  isWaitingForEnrolment,
  saysWhatIsHappening,
  showsRegistrationFacts,
  studentNumberLinkBand,
} from "../trackerView"

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
  student_facing_status: "looking_for_enrolment",
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
  enrolment_link: null,
  linking_email: null,
  notification_email: null,
  ...overrides,
})

const route = (overrides: Partial<MyEnrolmentRoute> = {}): MyEnrolmentRoute => ({
  course_module_completion_id: "completion",
  route: "university_of_helsinki",
  enrolment_confirmed_at: null,
  can_change: true,
  ...overrides,
})

describe("whether the student is still asked where they enrol", () => {
  test("asks while we are still looking for an enrolment", () => {
    expect(asksWhereYouEnrolled({ registration: registration(), enrolmentRoute: route() })).toBe(
      true,
    )
  })

  test("stops asking the moment an enrolment is found, whatever the answer said", () => {
    expect(
      asksWhereYouEnrolled({
        registration: registration({ enrolment_found: true }),
        enrolmentRoute: route({ enrolment_confirmed_at: null }),
      }),
    ).toBe(false)
  })

  test("stops asking once the row is somewhere it cannot come back from", () => {
    for (const status of ["registered", "failed", "not_registering"] as const) {
      expect(
        asksWhereYouEnrolled({
          registration: registration({ student_facing_status: status }),
          enrolmentRoute: route(),
        }),
      ).toBe(false)
    }
  })

  test("keeps asking while the student is being asked for a student number instead", () => {
    expect(
      asksWhereYouEnrolled({
        registration: registration({ student_facing_status: "needs_student_number" }),
        enrolmentRoute: route(),
      }),
    ).toBe(true)
  })

  test("stops asking once a linking mail exists, which only a listed enrolment can produce", () => {
    expect(
      asksWhereYouEnrolled({
        registration: registration({
          student_facing_status: "needs_student_number",
          linking_email: {
            email_send_status: "sent",
            sent_at: "2026-08-20T10:00:00Z",
            emailed_to_masked: "...@helsinki.fi",
          },
        }),
        enrolmentRoute: route(),
      }),
    ).toBe(false)
  })
})

describe("waiting for the enrolment to turn up", () => {
  const confirmed = route({ enrolment_confirmed_at: "2026-08-21T09:00:00Z" })

  test("reads the two stages that mean the same thing as one wait", () => {
    for (const status of ["looking_for_enrolment", "needs_enrolment"] as const) {
      const view = {
        registration: registration({ student_facing_status: status }),
        enrolmentRoute: confirmed,
      }
      expect(isWaitingForEnrolment(view)).toBe(true)
      // The wait band says it; a second band repeating it would read as a separate problem.
      expect(saysWhatIsHappening(view)).toBe(false)
    }
  })

  test("waits only once the student has said they enrolled", () => {
    expect(isWaitingForEnrolment({ registration: registration(), enrolmentRoute: route() })).toBe(
      false,
    )
  })

  test("stops waiting the moment the enrolment is found", () => {
    expect(
      isWaitingForEnrolment({
        registration: registration({ enrolment_found: true }),
        enrolmentRoute: confirmed,
      }),
    ).toBe(false)
  })
})

describe("whether the state gets said in its own words", () => {
  test("stays quiet while the question band already gives the enrolment instructions", () => {
    expect(saysWhatIsHappening({ registration: registration(), enrolmentRoute: route() })).toBe(
      false,
    )
  })

  test("stays quiet for the student number, which the linking band says in full", () => {
    expect(
      saysWhatIsHappening({
        registration: registration({ student_facing_status: "needs_student_number" }),
        enrolmentRoute: route(),
      }),
    ).toBe(false)
  })

  test("speaks up for anything neither the question nor the wait covers", () => {
    for (const status of ["failed", "waiting_for_sisu"] as const) {
      expect(
        saysWhatIsHappening({
          registration: registration({ student_facing_status: status }),
          enrolmentRoute: route(),
        }),
      ).toBe(true)
    }
  })

  test("speaks up once the question is behind the student", () => {
    expect(
      saysWhatIsHappening({
        registration: registration({ enrolment_found: true }),
        enrolmentRoute: route(),
      }),
    ).toBe(true)
  })
})

describe("whether the transcript facts belong on the page", () => {
  test("shows them only once there is something registered to show", () => {
    expect(showsRegistrationFacts(registration())).toBe(false)
    expect(showsRegistrationFacts(registration({ registered_at: "2026-09-08T09:00:00Z" }))).toBe(
      true,
    )
  })
})

describe("what the linking band says", () => {
  const linked = {
    student_number: "014567890",
    verified_at: "2026-08-21T07:00:00Z",
    verified_via: "emailed_link",
    linked_automatically: false,
    auto_link_notice_dismissed: true,
  } as const

  test("promises the number while the credits are still on their way", () => {
    expect(studentNumberLinkBand(registration(), linked)).toEqual({
      kind: "registering",
      studentNumber: "014567890",
    })
  })

  test("drops the promise once the row has failed", () => {
    expect(
      studentNumberLinkBand(registration({ student_facing_status: "failed" }), linked),
    ).toEqual({ kind: "linked", studentNumber: "014567890" })
  })

  test("says nothing where the fact sheet already names the number", () => {
    expect(
      studentNumberLinkBand(
        registration({
          student_facing_status: "registered",
          registered_at: "2026-09-08T09:00:00Z",
        }),
        linked,
      ),
    ).toBeNull()
  })

  test("says nothing about a row nobody is registering", () => {
    expect(
      studentNumberLinkBand(registration({ student_facing_status: "not_registering" }), linked),
    ).toBeNull()
  })

  test("explains the wait before any mail can exist", () => {
    expect(studentNumberLinkBand(registration(), null)).toEqual({ kind: "awaiting-enrolment" })
  })

  test("stops promising a future mail once one is queued", () => {
    expect(
      studentNumberLinkBand(
        registration({
          linking_email: { email_send_status: "queued", emailed_to_masked: "...@helsinki.fi" },
        }),
        null,
      ),
    ).toEqual({ kind: "mailing" })
  })

  test("names the mailbox and the date once a mail has gone out", () => {
    expect(
      studentNumberLinkBand(
        registration({
          linking_email: {
            email_send_status: "sent",
            sent_at: "2026-08-20T10:00:00Z",
            emailed_to_masked: "...@helsinki.fi",
          },
        }),
        null,
      ),
    ).toEqual({ kind: "mailed", emailMasked: "...@helsinki.fi", sentAt: "2026-08-20T10:00:00Z" })
  })

  test("says the mail failed rather than telling them to look for it", () => {
    expect(
      studentNumberLinkBand(
        registration({
          linking_email: { email_send_status: "send_failed", emailed_to_masked: "...@helsinki.fi" },
        }),
        null,
      ),
    ).toEqual({ kind: "send-failed" })
  })
})
