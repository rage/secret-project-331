import accessibilityCheck from "@/utils/accessibilityCheck"
import { selectCourseInstanceIfPrompted } from "@/utils/courseMaterialActions"
import {
  answerCreditRegistrationConsent,
  completionRegistrationUrl,
  countMockCallsForStudent,
  courseFrontPageUrl,
  CRS_101,
  legacyPullStream,
  myRegistrationOnCourse,
  PROFILE_CREDIT_REGISTRATION_URL,
  seededStudentStorageState,
  SUOTAR_COURSE_SLUG,
  waitForCreditRegistrationConsentDialog,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import { makeRegistrationDueNow } from "@/utils/creditRegistrationAdmin"
import { transitionMockSuotarSubmissionsFor } from "@/utils/mockSuotar"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import {
  runImportSubmissionTick,
  runMaterializeTick,
  runPreconditionsTick,
  runResolveEnrolmentsTick,
  runVerifyPollTick,
} from "@/utils/suotarControl"

/**
 * Owns student numbers `9000001xx`. Doubles as the integration test of the tick endpoints and the
 * mock control API, so nothing else in this directory is trustworthy until it passes.
 */
const STUDENT_EMAIL = "credit-registration-not-consented@example.com"
const STUDENT_NUMBER = "900000103"
const PAGE_URL = `${courseFrontPageUrl(SUOTAR_COURSE_SLUG)}/chapter-1/page-1`

test.use({ storageState: seededStudentStorageState(STUDENT_EMAIL) })

test("Student consents, links student number, gets automatically registered end to end", async ({
  page,
  adminApi,
}) => {
  const scope = { userEmail: STUDENT_EMAIL }

  await test.step("The consent dialog is part of the course-start chain", async () => {
    await page.goto(PAGE_URL)
    await selectCourseInstanceIfPrompted(page)
    await waitForCreditRegistrationConsentDialog(page)
    await expect(page.getByText("Registering your credits in Sisu")).toBeVisible()
    await accessibilityCheck(page, "Credit registration consent dialog")
    await answerCreditRegistrationConsent(page, "accept")
  })

  await test.step("Consent unblocks the seeded completion", async () => {
    await runMaterializeTick(page.request, scope)
    await runPreconditionsTick(page.request, scope)
    await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "ready_to_submit",
      "checking_enrolment",
      "submitting",
      "awaiting_verification",
    ])
  })

  const submitted = await test.step("The completion is submitted exactly once", async () => {
    await runResolveEnrolmentsTick(page.request, scope)
    await runImportSubmissionTick(page.request, scope)
    const row = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "awaiting_verification",
    ])
    expect(row.student_facing_status).toBe("waiting_for_sisu")
    expect(await countMockCallsForStudent(page.request, STUDENT_NUMBER, "import_attainments")).toBe(
      1,
    )
    return row
  })

  await test.step("Polling does not report success before the study registry does", async () => {
    await makeRegistrationDueNow(adminApi, submitted.id)
    await runVerifyPollTick(page.request, scope)
    const row = await myRegistrationOnCourse(page.request, adminApi, SUOTAR_COURSE_SLUG)
    expect(row.state).toBe("awaiting_verification")
    expect(row.sisu_attainment_id).toBeNull()
  })

  await test.step("Once the study registry confirms, the row is registered", async () => {
    await transitionMockSuotarSubmissionsFor(page.request, STUDENT_NUMBER, "registered", CRS_101)
    await makeRegistrationDueNow(adminApi, submitted.id)
    await runVerifyPollTick(page.request, scope)
    const registered = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "registered",
    ])
    expect(registered.sisu_attainment_id).not.toBeNull()
    expect(registered.registered_at).not.toBeNull()
    expect(await countMockCallsForStudent(page.request, STUDENT_NUMBER, "import_attainments")).toBe(
      1,
    )
  })

  await test.step("The student sees it on the status page and on their profile", async () => {
    const row = await myRegistrationOnCourse(page.request, adminApi, SUOTAR_COURSE_SLUG)
    await page.goto(completionRegistrationUrl(row.course_module_id))
    await expect(page.getByRole("list", { name: "Credit registration progress" })).toBeVisible()
    await expect(page.getByText("Registered in Sisu").first()).toBeVisible()
    await accessibilityCheck(page, "Credit registration status page")

    await page.goto(PROFILE_CREDIT_REGISTRATION_URL)
    await expect(
      page.getByRole("heading", { level: 3, name: "My credit registrations" }),
    ).toBeVisible()
    await expect(
      page.getByRole("table", { name: "My credit registrations" }).getByText("Registered in Sisu"),
    ).toBeVisible()
    await accessibilityCheck(page, "Profile credit registration tab")
  })

  await test.step("A Suotar-enabled module has left the legacy pull stream", async () => {
    const stream = await legacyPullStream(page.request, SUOTAR_COURSE_SLUG)
    expect(stream).not.toContain(STUDENT_EMAIL)
    expect(stream).not.toContain(STUDENT_NUMBER)
  })
})
