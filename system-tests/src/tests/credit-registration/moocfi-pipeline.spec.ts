import type { APIRequestContext } from "@playwright/test"

import { getJson, linkStudentNumberUrl } from "@/utils/creditRegistration"
import {
  ADMIN_REGISTRATIONS_URL,
  adminRegistrationDetails,
  type AdminRegistrationsPage,
  listAdminRegistrations,
  makeRegistrationDueNow,
} from "@/utils/creditRegistrationAdmin"
import {
  CRS_MOOCFI_101,
  CRS_MOOCFI_TIER_2,
  CRS_MOOCFI_TIER_3,
  forgetMockMoocfiStudent,
  mockMoocfiRegistrationsOf,
  MOOCFI_COURSE,
  MOOCFI_LINKING_TOKEN,
  MOOCFI_PIPELINE_STUDENT_NUMBER,
  MOOCFI_STUDENT_2,
  MOOCFI_TARGET_ID,
  MOOCFI_TARGET_NAME,
  MOOCFI_TIER_2_CODE_ID,
  MOOCFI_TIER_2_CODE_NAME,
  MOOCFI_TIER_3_CODE_ID,
  MOOCFI_TIER_3_CODE_NAME,
  MOOCFI_TIERED_COURSE,
  MOOCFI_TIERED_TARGET_ID,
  MOOCFI_TIERED_TARGET_NAME,
  moocfiRegistrationUrl,
  myMoocfiCreditRegistrations,
  openRegistrationFromMoocfi,
  seedMockMoocfiCompletions,
} from "@/utils/mockMoocfi"
import {
  activeStudyRightPeriod,
  transitionMockSuotarSubmissionsFor,
  upsertMockSuotarEnrolments,
} from "@/utils/mockSuotar"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import {
  queuedEmailsFor,
  runEnrolmentCheckNow,
  runImportSubmissionTick,
  runMaterializeTick,
  runMoocfiReportTick,
  runPreconditionsTick,
  runStudentNotificationsTick,
  runVerifyPollTick,
} from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/**
 * Owns `moocfi-student-2` on the delegated mooc.fi course, and the seeded linking token for
 * `090003017`, which a run spends: the database must be reseeded before the next run.
 */
const STUDENT = MOOCFI_STUDENT_2
const COMPLETION_ID = "c5ed17ea-2a01-4a5e-9e6e-c0de00002a01"
const SCOPE = { externalCreditTargetId: MOOCFI_TARGET_ID, userEmail: STUDENT.email }
const TIER_3_COMPLETION_ID = "c5ed17ea-2a02-4a5e-9e6e-c0de00002a02"
const TIERED_SCOPE = {
  externalCreditTargetId: MOOCFI_TIERED_TARGET_ID,
  userEmail: STUDENT.email,
}

/** The student's one ledger row on the target, once materialize has written it. */
const moocfiRegistrationId = (adminApi: APIRequestContext): Promise<string> =>
  pollUntil(
    async () => {
      const { data } = await listAdminRegistrations(adminApi, { course_id: MOOCFI_TARGET_ID })
      return data.find((row) => row.email === STUDENT.email)?.id ?? null
    },
    { description: `a ledger row for ${STUDENT.email} on the mooc.fi target` },
  )

/** The student's ledger row under one mooc.fi code, once materialize has written it. */
const codeRegistrationId = (adminApi: APIRequestContext, codeId: string): Promise<string> =>
  pollUntil(
    async () => {
      const { data } = await getJson<AdminRegistrationsPage>(
        adminApi,
        `${ADMIN_REGISTRATIONS_URL}?include_not_started=true&course_module_id=${codeId}`,
      )
      return data.find((row) => row.email === STUDENT.email)?.id ?? null
    },
    { description: `a ledger row for ${STUDENT.email} under the mooc.fi code ${codeId}` },
  )

const waitForState = (adminApi: APIRequestContext, registrationId: string, state: string) =>
  pollUntil(
    async () =>
      (await adminRegistrationDetails(adminApi, registrationId)).registration.state === state,
    { description: `${registrationId} to reach ${state}` },
  )

test("A mooc.fi completion is registered in Sisu and reported back to mooc.fi once", async ({
  page,
  request,
  adminApi,
}) => {
  test.slow()
  await forgetMockMoocfiStudent(request, STUDENT)
  await seedMockMoocfiCompletions(request, [
    {
      id: COMPLETION_ID,
      course_id: MOOCFI_COURSE.id,
      user_upstream_id: STUDENT.upstreamId,
      eligible_for_ects: true,
      grade: null,
    },
  ])

  await openRegistrationFromMoocfi(page, MOOCFI_COURSE, STUDENT)
  await expect(page.getByText(`Course: ${MOOCFI_TARGET_NAME}`)).toBeVisible()

  const registrationId =
    await test.step("materialize and preconditions wait for a student number", async () => {
      await runMaterializeTick(request, SCOPE)
      const id = await moocfiRegistrationId(adminApi)
      await runPreconditionsTick(request, SCOPE)
      const { registration } = await adminRegistrationDetails(adminApi, id)
      expect(registration.state).toBe("pending")
      expect(registration.pending_reason).toBe("student_number")
      return id
    })

  await test.step("A mooc.fi registration gets no enrolment-needed email", async () => {
    await runStudentNotificationsTick(request, SCOPE)
    const queued = await queuedEmailsFor(request, STUDENT.email)
    expect(queued.map((mail) => mail.templateType)).not.toContain(
      "credit_registration_action_needed",
    )
  })

  await test.step("The student links their student number", async () => {
    await page.goto(linkStudentNumberUrl(MOOCFI_LINKING_TOKEN))
    await expect(page.getByText(MOOCFI_PIPELINE_STUDENT_NUMBER)).toBeVisible()
    await page.getByTestId("link-student-number-confirm-button").click()
    await expect(page.getByText("Student number linked")).toBeVisible()
  })

  await test.step("The enrolment resolves and the credit is imported", async () => {
    await runEnrolmentCheckNow(request, SCOPE)
    await runImportSubmissionTick(request, SCOPE)
    await waitForState(adminApi, registrationId, "awaiting_verification")
  })

  await test.step("Sisu confirms it", async () => {
    await transitionMockSuotarSubmissionsFor(
      request,
      MOOCFI_PIPELINE_STUDENT_NUMBER,
      "registered",
      CRS_MOOCFI_101,
    )
    await makeRegistrationDueNow(adminApi, registrationId)
    await runVerifyPollTick(request, SCOPE)
    await waitForState(adminApi, registrationId, "registered")
  })

  await test.step("moocfi-report posts the registration to mooc.fi exactly once", async () => {
    await runMoocfiReportTick(request, SCOPE)
    const details = await pollUntil(
      async () => {
        const current = await adminRegistrationDetails(adminApi, registrationId)
        return current.moocfi_completion?.registration_report.reported_at ? current : null
      },
      { description: "the registration to be reported" },
    )
    expect(details.moocfi_completion?.moocfi_completion_id).toBe(COMPLETION_ID)

    // A second report finds nothing left to post.
    await runMoocfiReportTick(request, SCOPE)
    const posted = await mockMoocfiRegistrationsOf(request, COMPLETION_ID)
    expect(posted).toHaveLength(1)
    expect(posted[0]?.student_number).toBe(MOOCFI_PIPELINE_STUDENT_NUMBER)
  })

  await test.step("The student's page shows the credit registered", async () => {
    await page.goto(`/completion-registration/mooc-fi/${MOOCFI_COURSE.id}`)
    await expect(page.getByRole("heading", { name: "Your completion is registered" })).toBeVisible()
  })

  await test.step("A tier 3 completion shows both of its courses", async () => {
    await upsertMockSuotarEnrolments(
      request,
      [CRS_MOOCFI_TIER_2, CRS_MOOCFI_TIER_3].map((courseCode) => ({
        studentNumber: MOOCFI_PIPELINE_STUDENT_NUMBER,
        courseCode,
        kind: "degree" as const,
        state: "ENROLLED" as const,
        studyRightValidityPeriod: activeStudyRightPeriod(),
      })),
    )
    await seedMockMoocfiCompletions(request, [
      {
        id: TIER_3_COMPLETION_ID,
        course_id: MOOCFI_TIERED_COURSE.id,
        user_upstream_id: STUDENT.upstreamId,
        eligible_for_ects: true,
        tier: 3,
      },
    ])
    await page.goto(moocfiRegistrationUrl(MOOCFI_TIERED_COURSE))
    await expect(page.getByText(`Course: ${MOOCFI_TIERED_TARGET_NAME}`)).toBeVisible()
    const completion = (
      await myMoocfiCreditRegistrations(page.request, MOOCFI_TIERED_COURSE)
    ).completions.find((row) => row.moocfi_completion_id === TIER_3_COMPLETION_ID)
    expect(completion?.credit_units.map((unit) => unit.credit_unit.uh_course_code)).toStrictEqual([
      CRS_MOOCFI_TIER_2,
      CRS_MOOCFI_TIER_3,
    ])
    expect(completion?.credit_units.map((unit) => unit.status)).toStrictEqual([
      "registering_on_courses",
      "registering_on_courses",
    ])
  })

  const [intermediateId, advancedId] =
    await test.step("The intermediate course is sent, and the advanced one waits for it", async () => {
      await runMaterializeTick(request, TIERED_SCOPE)
      const intermediate = await codeRegistrationId(adminApi, MOOCFI_TIER_2_CODE_ID)
      const advanced = await codeRegistrationId(adminApi, MOOCFI_TIER_3_CODE_ID)
      await runEnrolmentCheckNow(request, TIERED_SCOPE)
      await runImportSubmissionTick(request, TIERED_SCOPE)
      await waitForState(adminApi, intermediate, "awaiting_verification")
      // Held by its prerequisite after its enrolment was found.
      await waitForState(adminApi, advanced, "checking_enrolment")

      await page.reload()
      await expect(page.getByRole("heading", { name: "Registering your completion" })).toBeVisible()
      await expect(page.getByRole("heading", { name: MOOCFI_TIER_2_CODE_NAME })).toBeVisible()
      await expect(page.getByRole("heading", { name: MOOCFI_TIER_3_CODE_NAME })).toBeVisible()
      await expect(
        page.getByText(
          `We send this course to Sisu after ${MOOCFI_TIER_2_CODE_NAME} is registered.`,
        ),
      ).toBeVisible()
      return [intermediate, advanced] as const
    })

  await test.step("Once the intermediate course is registered, the advanced one is sent", async () => {
    await transitionMockSuotarSubmissionsFor(
      request,
      MOOCFI_PIPELINE_STUDENT_NUMBER,
      "registered",
      CRS_MOOCFI_TIER_2,
    )
    await makeRegistrationDueNow(adminApi, intermediateId)
    await runVerifyPollTick(request, TIERED_SCOPE)
    await waitForState(adminApi, intermediateId, "registered")
    await runImportSubmissionTick(request, TIERED_SCOPE)
    await waitForState(adminApi, advancedId, "awaiting_verification")
  })
})
