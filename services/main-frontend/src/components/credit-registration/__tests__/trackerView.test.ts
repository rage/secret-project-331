import type { MyCreditRegistration, MyEnrolmentRoute } from "@/generated/api/types.generated"

import { asksWhereYouEnrolled, saysWhatIsHappening, showsRegistrationFacts } from "../trackerView"

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
})

describe("whether the state gets said in its own words", () => {
  test("stays quiet while the question band already says we are looking", () => {
    expect(saysWhatIsHappening({ registration: registration(), enrolmentRoute: route() })).toBe(
      false,
    )
  })

  test("speaks up for anything the question cannot cover", () => {
    for (const status of ["needs_enrolment", "needs_student_number", "failed"] as const) {
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
