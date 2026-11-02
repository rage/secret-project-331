import type { APIRequestContext } from "@playwright/test"

import { linkStudentNumberUrl } from "@/utils/creditRegistration"
import {
  adminRegistrationDetails,
  listAdminRegistrations,
  makeRegistrationDueNow,
} from "@/utils/creditRegistrationAdmin"
import {
  CRS_MOOCFI_101,
  forgetMockMoocfiStudent,
  mockMoocfiRegistrationsOf,
  MOOCFI_COURSE,
  MOOCFI_LINKING_TOKEN,
  MOOCFI_PIPELINE_STUDENT_NUMBER,
  MOOCFI_STUDENT_2,
  MOOCFI_TARGET_ID,
  MOOCFI_TARGET_NAME,
  openRegistrationFromMoocfi,
  seedMockMoocfiCompletions,
} from "@/utils/mockMoocfi"
import { transitionMockSuotarSubmissionsFor } from "@/utils/mockSuotar"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import {
  runEnrolmentCheckNow,
  runImportSubmissionTick,
  runMaterializeTick,
  runMoocfiReportTick,
  runPreconditionsTick,
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

/** The student's one ledger row on the target, once materialize has written it. */
const moocfiRegistrationId = (adminApi: APIRequestContext): Promise<string> =>
  pollUntil(
    async () => {
      const { data } = await listAdminRegistrations(adminApi, { course_id: MOOCFI_TARGET_ID })
      return data.find((row) => row.email === STUDENT.email)?.id ?? null
    },
    { description: `a ledger row for ${STUDENT.email} on the mooc.fi target` },
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
  await expect(page.getByText(MOOCFI_TARGET_NAME)).toBeVisible()

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
        return current.moocfi_completion?.reported_at ? current : null
      },
      { description: "the mooc.fi completion to be reported" },
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
    await expect(page.getByText("Registered in Sisu")).toBeVisible()
  })
})
