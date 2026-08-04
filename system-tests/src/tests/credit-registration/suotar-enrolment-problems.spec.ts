import {
  completionRegistrationUrl,
  CRS_101,
  seededStudentStorageState,
  SUOTAR_COURSE_SLUG,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import { listAdminRegistrations } from "@/utils/creditRegistrationAdmin"
import { expect, test } from "@/utils/fixtures"
import { getMockSuotarWorld, upsertMockSuotarEnrolments } from "@/utils/mockSuotar"
import {
  runImportSubmissionTick,
  runMaterializeTick,
  runPhasesUpToSubmission,
  runPreconditionsTick,
  runProductTokenRefreshTick,
  runResolveEnrolmentsTick,
} from "@/utils/suotarControl"

/** Owns student numbers `9000003xx`. */
const NO_ENROLMENT_EMAIL = "credit-registration-no-enrolment@example.com"
const NO_ENROLMENT_STUDENT_NUMBER = "900000301"
const TWO_ENROLMENTS_EMAIL = "credit-registration-two-enrolments@example.com"
const TWO_ENROLMENTS_STUDENT_NUMBER = "900000302"

const YEAR = 365 * 24 * 60 * 60 * 1000
const isoDate = (offsetMs: number) =>
  new Date(Date.now() + offsetMs).toISOString().slice(0, "2026-01-01".length)

test.describe("A student the University has no enrolment for", () => {
  test.use({ storageState: seededStudentStorageState(NO_ENROLMENT_EMAIL) })

  test("A student the University has not enrolled is told to enrol, and recovers once they do", async ({
    page,
  }) => {
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
})

test.describe("A student enrolled both as a degree student and through the Open University", () => {
  test.use({ storageState: seededStudentStorageState(TWO_ENROLMENTS_EMAIL) })

  test("Enrolment selection prefers the degree enrolment over the open university one", async ({
    adminApi,
    page,
  }) => {
    const scope = { userEmail: TWO_ENROLMENTS_EMAIL }

    await runPhasesUpToSubmission(page.request, scope)
    await waitForRegistrationState(page.request, SUOTAR_COURSE_SLUG, [
      "awaiting_verification",
      "registered",
      "duplicate",
    ])

    // Both enrolments would have submitted successfully, so only the chosen id says the policy ran.
    // It is read back from the mock's world because the mock derives enrolment ids from an opaque
    // UUIDv5 rather than from the student number.
    const world = (await getMockSuotarWorld(page.request)) as {
      enrolments: { id: string; studentNumber: string; courseCode: string; realisationId: string }[]
    }
    const degreeEnrolment = world.enrolments.find(
      (enrolment) =>
        enrolment.studentNumber === TWO_ENROLMENTS_STUDENT_NUMBER &&
        enrolment.courseCode === CRS_101 &&
        enrolment.realisationId.endsWith("-degree"),
    )
    expect(degreeEnrolment, "the degree enrolment is missing from the mock's world").toBeDefined()

    const listed = await listAdminRegistrations(adminApi, {
      student_number: TWO_ENROLMENTS_STUDENT_NUMBER,
    })
    expect(listed.data).toHaveLength(1)
    expect(listed.data[0]?.selected_enrolment_id).toBe(degreeEnrolment?.id)
  })
})
