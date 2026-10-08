import type { MyCreditRegistration, MyEnrolmentRoute } from "@/generated/api/types.generated"

import {
  asksWhereYouEnrolled,
  isLinkingEmailOverdue,
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
  is_processing_in_sisu: false,
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

const mail = (
  overrides: Partial<NonNullable<MyCreditRegistration["linking_email"]>> = {},
): NonNullable<MyCreditRegistration["linking_email"]> => ({
  email_send_status: "sent",
  sent_at: "2026-08-20T10:00:00Z",
  emailed_to_masked: "...@example.com",
  link_state: "usable",
  can_send_another: true,
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

  test("stops asking once the row is past needing an enrolment", () => {
    for (const status of [
      "registered",
      "failed",
      "not_registering",
      "sending",
      "waiting_for_sisu",
    ] as const) {
      expect(
        asksWhereYouEnrolled({
          registration: registration({ student_facing_status: status }),
          enrolmentRoute: route(),
        }),
      ).toBe(false)
    }
  })

  test("stops asking while the row is parked on a course-setup problem, not an enrolment one", () => {
    expect(
      asksWhereYouEnrolled({
        registration: registration({ student_facing_status: "waiting_for_course_setup" }),
        enrolmentRoute: route(),
      }),
    ).toBe(false)
  })

  test("keeps asking while the student is being asked for a student number instead", () => {
    expect(
      asksWhereYouEnrolled({
        registration: registration({ student_facing_status: "needs_student_number" }),
        enrolmentRoute: route(),
      }),
    ).toBe(true)
  })

  test("does not ask without the stored answer, which the question band is drawn from", () => {
    expect(asksWhereYouEnrolled({ registration: registration(), enrolmentRoute: null })).toBe(false)
  })

  test("stops asking once a linking mail exists, which only a listed enrolment can produce", () => {
    expect(
      asksWhereYouEnrolled({
        registration: registration({
          student_facing_status: "needs_student_number",
          linking_email: {
            email_send_status: "sent",
            sent_at: "2026-08-20T10:00:00Z",
            emailed_to_masked: "...@example.com",
            link_state: "usable",
            can_send_another: true,
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
  test("leaves the enrolment question as the last thing on the page", () => {
    for (const status of ["looking_for_enrolment", "needs_enrolment"] as const) {
      const view = {
        registration: registration({ student_facing_status: status }),
        enrolmentRoute: route(),
      }
      expect(asksWhereYouEnrolled(view)).toBe(true)
      expect(saysWhatIsHappening(view)).toBe(false)
    }
  })

  test("speaks up once the question is no longer asked", () => {
    expect(
      saysWhatIsHappening({
        registration: registration({ student_facing_status: "sending" }),
        enrolmentRoute: route(),
      }),
    ).toBe(true)
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
    for (const status of ["failed", "waiting_for_sisu", "waiting_for_course_setup"] as const) {
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
  } as const
  const linkingOn = { isAccountLinkingEnabled: true, enrolmentRoute: route() }

  test("promises the number while the credits are still on their way", () => {
    expect(studentNumberLinkBand(registration(), linked, linkingOn)).toEqual({
      kind: "registering",
      studentNumber: "014567890",
    })
  })

  test("drops the promise once the row has failed", () => {
    expect(
      studentNumberLinkBand(registration({ student_facing_status: "failed" }), linked, linkingOn),
    ).toEqual({ kind: "linked", studentNumber: "014567890" })
  })

  test("drops the promise on a registered row that has no fact sheet to name the number", () => {
    expect(
      studentNumberLinkBand(
        registration({ student_facing_status: "registered", registered_at: null }),
        linked,
        linkingOn,
      ),
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
        linkingOn,
      ),
    ).toBeNull()
  })

  test("says nothing about a registered row whose account no longer holds the link", () => {
    expect(
      studentNumberLinkBand(
        registration({
          student_facing_status: "registered",
          registered_at: "2026-09-08T09:00:00Z",
        }),
        null,
        linkingOn,
      ),
    ).toBeNull()
  })

  test("says nothing about a row nobody is registering", () => {
    expect(
      studentNumberLinkBand(
        registration({ student_facing_status: "not_registering" }),
        linked,
        linkingOn,
      ),
    ).toBeNull()
  })

  test("explains the wait before any mail can exist", () => {
    expect(studentNumberLinkBand(registration(), null, linkingOn)).toEqual({
      kind: "awaiting-enrolment",
    })
  })

  test("stops telling them to enrol once they say they have", () => {
    expect(
      studentNumberLinkBand(registration(), null, {
        isAccountLinkingEnabled: true,
        enrolmentRoute: route({
          route: "open_university",
          enrolment_confirmed_at: "2026-08-21T07:00:00Z",
        }),
      }),
    ).toEqual({
      kind: "awaiting-email",
      isOpenUniversity: true,
      waitingSince: "2026-08-21T07:00:00Z",
    })
  })

  test("stops telling them to enrol once a mail is queued", () => {
    expect(
      studentNumberLinkBand(
        registration({ linking_email: mail({ email_send_status: "queued", sent_at: null }) }),
        null,
        linkingOn,
      ),
    ).toEqual({ kind: "awaiting-email", isOpenUniversity: false, waitingSince: null })
  })

  test("names the mailbox and the date once a mail has gone out", () => {
    expect(studentNumberLinkBand(registration({ linking_email: mail() }), null, linkingOn)).toEqual(
      { kind: "mailed", emailMasked: "...@example.com", sentAt: "2026-08-20T10:00:00Z" },
    )
  })

  test("says an expired link will be replaced while the caps allow another", () => {
    expect(
      studentNumberLinkBand(
        registration({ linking_email: mail({ link_state: "expired" }) }),
        null,
        linkingOn,
      ),
    ).toEqual({
      kind: "link-expired",
      emailMasked: "...@example.com",
      sentAt: "2026-08-20T10:00:00Z",
    })
  })

  test("sends them to support once no new mail can replace a used or expired link", () => {
    const confirmed = {
      isAccountLinkingEnabled: true,
      enrolmentRoute: route({ enrolment_confirmed_at: "2026-08-21T07:00:00Z" }),
    }
    for (const linkingEmail of [
      mail({ link_state: "used" }),
      mail({ link_state: "expired", can_send_another: false }),
    ]) {
      for (const options of [linkingOn, confirmed]) {
        expect(
          studentNumberLinkBand(registration({ linking_email: linkingEmail }), null, options),
        ).toEqual({ kind: "contact-support" })
      }
    }
  })

  test("says the mail failed rather than telling them to look for it", () => {
    expect(
      studentNumberLinkBand(
        registration({ linking_email: mail({ email_send_status: "send_failed", sent_at: null }) }),
        null,
        linkingOn,
      ),
    ).toEqual({ kind: "send-failed" })
  })

  test("promises no mail while account linking is off", () => {
    const linkingOff = { isAccountLinkingEnabled: false, enrolmentRoute: route() }
    expect(studentNumberLinkBand(registration(), null, linkingOff)).toEqual({
      kind: "staff-links",
    })
    expect(
      studentNumberLinkBand(
        registration({
          linking_email: mail({ email_send_status: "queued", sent_at: null }),
        }),
        null,
        linkingOff,
      ),
    ).toEqual({ kind: "staff-links" })
  })
})

describe("when a missing linking email is worth a mail to support", () => {
  const pressedAt = "2026-08-21T07:00:00Z"
  const day = 24 * 60 * 60 * 1000

  test("only two days after they said they enrolled", () => {
    expect(isLinkingEmailOverdue(pressedAt, Date.parse(pressedAt) + day)).toBe(false)
    expect(isLinkingEmailOverdue(pressedAt, Date.parse(pressedAt) + 2 * day)).toBe(true)
    expect(isLinkingEmailOverdue(null, Date.parse(pressedAt) + 30 * day)).toBe(false)
  })
})
