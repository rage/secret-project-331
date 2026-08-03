import { expect, test } from "@playwright/test"

import {
  completionRegistrationUrl,
  CREDIT_REGISTRATION_ADMIN_API,
  CRS_101,
  loginAsSeededStudent,
  SUOTAR_COURSE_SLUG,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import { upsertMockSuotarEnrolments } from "@/utils/mockSuotar"
import {
  runImportSubmissionTick,
  runMaterializeTick,
  runPreconditionsTick,
  runProductTokenRefreshTick,
  runResolveEnrolmentsTick,
} from "@/utils/suotarControl"

/** Owns student numbers `9000003xx`. */
const NO_ENROLMENT_EMAIL = "credit-registration-no-enrolment@example.com"
const NO_ENROLMENT_STUDENT_NUMBER = "900000301"
const TWO_ENROLMENTS_EMAIL = "credit-registration-two-enrolments@example.com"
const TWO_ENROLMENTS_STUDENT_NUMBER = "900000302"
const ADMIN_STORAGE_STATE = "src/states/admin@example.com.json"

const YEAR = 365 * 24 * 60 * 60 * 1000
const isoDate = (offsetMs: number) =>
  new Date(Date.now() + offsetMs).toISOString().slice(0, "2026-01-01".length)

test("A student the University has not enrolled is told to enrol, and recovers once they do", async ({
  page,
}) => {
  await loginAsSeededStudent(page, NO_ENROLMENT_EMAIL)
  const scope = { userEmail: NO_ENROLMENT_EMAIL }

  await runProductTokenRefreshTick(page.request, { courseSlug: SUOTAR_COURSE_SLUG })
  await runMaterializeTick(page.request, scope)
  await runPreconditionsTick(page.request, scope)
  await runResolveEnrolmentsTick(page.request, scope)

  const stuck = await waitForRegistrationState(page.request, SUOTAR_COURSE_SLUG, [
    "no_usable_enrolment",
  ])
  expect(stuck.student_facing_status).toBe("needs_enrolment")

  await test.step("The guidance is a working link, not an instruction to go looking", async () => {
    expect(stuck.enrolment_link).not.toBeNull()
    await page.goto(completionRegistrationUrl(stuck.course_module_id))
    const enrol = page.getByRole("link", { name: "Enrol at the Open University" })
    await expect(enrol).toBeVisible()
    // Built from the product access token the refresh phase fetched, so it lands the student
    // somewhere that works rather than on a generic front page.
    await expect(enrol).toHaveAttribute("href", /token/)
    await expect(page.getByRole("button", { name: "I have enrolled, check again" })).toBeVisible()
  })

  await test.step("It heals itself once the enrolment appears", async () => {
    await upsertMockSuotarEnrolments(page.request, [
      {
        studentNumber: NO_ENROLMENT_STUDENT_NUMBER,
        courseCode: CRS_101,
        kind: "degree",
        state: "ENROLLED",
        studyRightValidityPeriod: { startDate: isoDate(-YEAR), endDate: isoDate(YEAR) },
      },
    ])
    await runResolveEnrolmentsTick(page.request, scope)
    await runImportSubmissionTick(page.request, scope)
    await waitForRegistrationState(page.request, SUOTAR_COURSE_SLUG, [
      "ready_to_submit",
      "submitting",
      "awaiting_verification",
    ])
  })
})

test("Enrolment selection prefers the degree enrolment over the open university one", async ({
  browser,
  page,
}) => {
  await loginAsSeededStudent(page, TWO_ENROLMENTS_EMAIL)
  const scope = { userEmail: TWO_ENROLMENTS_EMAIL }

  await runMaterializeTick(page.request, scope)
  await runPreconditionsTick(page.request, scope)
  await runResolveEnrolmentsTick(page.request, scope)
  await runImportSubmissionTick(page.request, scope)
  await waitForRegistrationState(page.request, SUOTAR_COURSE_SLUG, [
    "awaiting_verification",
    "registered",
    "duplicate",
  ])

  // Asserted against the enrolment actually chosen rather than against the state, because both
  // enrolments would have submitted successfully and only the chosen id says the policy ran.
  const context = await browser.newContext({ storageState: ADMIN_STORAGE_STATE })
  try {
    const response = await context.request.get(
      `${CREDIT_REGISTRATION_ADMIN_API}/registrations?student_number=${TWO_ENROLMENTS_STUDENT_NUMBER}`,
    )
    expect(response.ok()).toBe(true)
    const page1 = (await response.json()) as {
      data: { selected_enrolment_id: string | null }[]
    }
    expect(page1.data).toHaveLength(1)
    expect(page1.data[0]?.selected_enrolment_id).toBe(`otm-${TWO_ENROLMENTS_STUDENT_NUMBER}-degree`)
  } finally {
    await context.close()
  }
})
