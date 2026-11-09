import type { MyCreditRegistration, MyEnrolmentRoute } from "@/generated/api/types.generated"

import {
  enrolmentCheckOpening,
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
  ...overrides,
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
    ).toEqual({ kind: "awaiting-email", isOpenUniversity: true })
  })

  test("stops telling them to enrol once a mail is queued", () => {
    expect(
      studentNumberLinkBand(
        registration({ linking_email: mail({ email_send_status: "queued", sent_at: null }) }),
        null,
        linkingOn,
      ),
    ).toEqual({ kind: "awaiting-email", isOpenUniversity: false })
  })

  test("names the mailbox and the date once a mail has gone out", () => {
    expect(studentNumberLinkBand(registration({ linking_email: mail() }), null, linkingOn)).toEqual(
      { kind: "mailed", emailMasked: "...@example.com", sentAt: "2026-08-20T10:00:00Z" },
    )
  })

  test("says an expired link will be replaced while the caps allow another", () => {
    expect(
      studentNumberLinkBand(
        registration({ linking_email: mail({ link_state: "expired_can_resend" }) }),
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
      mail({ link_state: "expired_no_resend" }),
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

describe("when the student is asked to check their enrolment", () => {
  const pressedAt = "2026-08-21T07:00:00Z"
  const hour = 60 * 60 * 1000
  const confirmed = route({ enrolment_confirmed_at: pressedAt })

  test("without a linked number, only two hours after they said they enrolled", () => {
    const input = { registration: registration(), enrolmentRoute: confirmed }
    expect(enrolmentCheckOpening(input, false, Date.parse(pressedAt) + hour)).toBeNull()
    expect(enrolmentCheckOpening(input, false, Date.parse(pressedAt) + 2 * hour)).toEqual({
      kind: "still-not-seen",
    })
  })

  test("with a linked number, as soon as the registry says why it cannot see the enrolment", () => {
    const input = {
      registration: registration({ error_code: "enrolment_not_accepted" }),
      enrolmentRoute: confirmed,
    }
    expect(enrolmentCheckOpening(input, true, Date.parse(pressedAt))).toEqual({
      kind: "registry-verdict",
      errorCode: "enrolment_not_accepted",
    })
  })

  test("with a linked number, also two hours after they said they enrolled", () => {
    const input = {
      registration: registration({ error_code: "sisu_timeout" }),
      enrolmentRoute: confirmed,
    }
    expect(enrolmentCheckOpening(input, true, Date.parse(pressedAt) + hour)).toBeNull()
    expect(enrolmentCheckOpening(input, true, Date.parse(pressedAt) + 2 * hour)).toEqual({
      kind: "still-not-seen",
    })
  })

  test("without a linked number, not on a registry verdict, which cannot be about them", () => {
    const input = {
      registration: registration({ error_code: "enrolment_not_found" }),
      enrolmentRoute: confirmed,
    }
    expect(enrolmentCheckOpening(input, false, Date.parse(pressedAt))).toBeNull()
  })

  test("before the registration exists, on time alone", () => {
    const input = { registration: null, enrolmentRoute: confirmed }
    expect(enrolmentCheckOpening(input, false, Date.parse(pressedAt) + 2 * hour)).toEqual({
      kind: "still-not-seen",
    })
  })

  test("never before they say they enrolled, or once the enrolment is found", () => {
    const pastThreshold = Date.parse(pressedAt) + 30 * 24 * hour
    expect(
      enrolmentCheckOpening(
        {
          registration: registration({ error_code: "enrolment_not_found" }),
          enrolmentRoute: route(),
        },
        true,
        pastThreshold,
      ),
    ).toBeNull()
    expect(
      enrolmentCheckOpening(
        { registration: registration({ enrolment_found: true }), enrolmentRoute: confirmed },
        false,
        pastThreshold,
      ),
    ).toBeNull()
  })
})
