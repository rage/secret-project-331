"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"

import type {
  MyCreditRegistration,
  MyEnrolmentRoute,
  MyVerifiedStudentNumber,
} from "@/generated/api/types.generated"
import { DialogProvider } from "@/shared-module/components"

import { courseModuleSubject, moocfiSubject } from "../creditRegistrationSubject"
import { RegistrationStepper } from "../stepper/RegistrationStepper"
import type { StepperCourse } from "../stepper/stepperView"

// t and Trans are mocked in tests/setup-jest.js to render the key, so pages are compared as keys.

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}))

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
  subject_id: "completion",
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

const STUDENT_NUMBER: MyVerifiedStudentNumber = {
  student_number: "012345678",
  verified_at: "2026-08-01T00:00:00Z",
  verified_via: "emailed_link",
  verified_via_email_masked: null,
}

const CONFIRMED_AT = "2026-09-01T00:00:00Z"

const SUBJECTS = [
  ["a module", courseModuleSubject("module")],
  ["a single-code mooc.fi completion", moocfiSubject("completion")],
] as const

/** The headings, paragraphs, links and buttons of the stepper's page, in order. */
const pageElements = (
  subject: (typeof SUBJECTS)[number][1],
  enrolmentRoute: MyEnrolmentRoute,
  options: { verifiedNumber?: MyVerifiedStudentNumber; registration?: MyCreditRegistration } = {},
): string[] => {
  const registrationRow = options.registration ?? registration()
  const course: StepperCourse = {
    key: "course",
    name: "Introduction to Programming",
    uhCourseCode: "AYTKT10002",
    ectsCredits: 5,
    enrolmentLink: "https://example.com/enrol",
    prerequisiteName: null,
    registration: registrationRow,
    enrolmentRoute,
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  const { container } = render(
    <QueryClientProvider client={client}>
      <DialogProvider>
        <RegistrationStepper
          subject={subject}
          courseName="mooc.fi course"
          moduleName={null}
          courses={[course]}
          registration={registrationRow}
          statusBeforeRegistration="sending"
          enrolmentRoute={enrolmentRoute}
          verifiedNumber={options.verifiedNumber ?? null}
          certificate={null}
          checkedAt={null}
        />
      </DialogProvider>
    </QueryClientProvider>,
  )
  return [
    ...(container.querySelector("article section")?.querySelectorAll("h2, p, a, button, ul") ?? []),
  ].map((element) => `${element.tagName.toLowerCase()}:${element.textContent}`)
}

describe.each(SUBJECTS)("the stepper for %s, which earns one course", (_kind, subject) => {
  test("asks for the enrolment on that course in Sisu, with no list of courses", () => {
    expect(pageElements(subject, route({ route: "university_of_helsinki" }))).toStrictEqual([
      "h2:1credit-registration-enrol-in-sisu-heading",
      "p:credit-registration-enrol-in-sisu-lead",
      "p:credit-registration-how-to-enrol-in-sisu link.opensInNewTab",
      "a:credit-registration-how-to-enrol-in-sisu link.opensInNewTab",
      "h2:2credit-registration-finished-enrolling-heading",
      "button:button-i-have-enrolled",
      "button:credit-registration-change-your-answers",
    ])
  })

  test("offers one enrol button at the Open University", () => {
    const elements = pageElements(
      subject,
      route({ route: "open_university", has_finnish_personal_identity_code: true }),
    )
    expect(elements.map((element) => element.split(" ")[0])).toStrictEqual([
      "h2:1credit-registration-enrol-at-open-university-heading",
      "p:credit-registration-enrol-at-open-university-lead",
      "a:credit-registration-action-enrol",
      "p:credit-registration-open-university-identification-caption",
      "h2:2credit-registration-finished-enrolling-heading",
      "button:button-i-have-enrolled",
      "button:credit-registration-change-your-answers",
    ])
  })

  test("names the one course whose enrolments are seen while linking", () => {
    const elements = pageElements(
      subject,
      route({ route: "university_of_helsinki", enrolment_confirmed_at: CONFIRMED_AT }),
    )
    expect(elements.slice(0, 5)).toStrictEqual([
      "h2:credit-registration-linking-heading",
      "p:credit-registration-link-staff-links-body",
      "p:credit-registration-link-only-once",
      "p:credit-registration-linking-wrong-course",
      "p:credit-registration-you-told-us-you-enrolled-sisu",
    ])
  })

  test("waits for the enrolment on the single-course waiting page", () => {
    const elements = pageElements(
      subject,
      route({ route: "university_of_helsinki", enrolment_confirmed_at: CONFIRMED_AT }),
      {
        verifiedNumber: STUDENT_NUMBER,
        registration: registration({
          student_facing_status: "needs_enrolment",
          student_number: STUDENT_NUMBER.student_number,
        }),
      },
    )
    expect(elements.slice(0, 4)).toStrictEqual([
      "h2:credit-registration-waiting-heading",
      "p:credit-registration-waiting-body",
      "p:credit-registration-waiting-for-enrolment-timing",
      "p:credit-registration-you-told-us-you-enrolled-sisu",
    ])
  })
})
