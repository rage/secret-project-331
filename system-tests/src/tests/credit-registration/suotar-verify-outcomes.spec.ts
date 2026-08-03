import { expect, test } from "@playwright/test"

import {
  countMockCallsForStudent,
  CRS_101,
  loginAsSeededStudent,
  myRegistrationOnCourse,
  SUOTAR_COURSE_SLUG,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import { transitionMockSuotarSubmissionsFor } from "@/utils/mockSuotar"
import {
  runImportSubmissionTick,
  runMaterializeTick,
  runPreconditionsTick,
  runResolveEnrolmentsTick,
  runVerifyPollTick,
} from "@/utils/suotarControl"

/**
 * Needs the single-phase `verify` tick so verification runs twice without re-running the import.
 * Owns student numbers `9000005xx`.
 */
const POLLING_EMAIL = "credit-registration-verify-polling@example.com"
const POLLING_STUDENT_NUMBER = "900000501"
const MISREGISTERED_EMAIL = "credit-registration-verify-misregistered@example.com"
const MISREGISTERED_STUDENT_NUMBER = "900000502"

const submitAndWait = async (
  request: Parameters<typeof myRegistrationOnCourse>[0],
  userEmail: string,
) => {
  const scope = { userEmail }
  await runMaterializeTick(request, scope)
  await runPreconditionsTick(request, scope)
  await runResolveEnrolmentsTick(request, scope)
  await runImportSubmissionTick(request, scope)
  return await waitForRegistrationState(request, SUOTAR_COURSE_SLUG, ["awaiting_verification"])
}

test("Polling stays in waiting until Sisu confirms, then flips to registered", async ({ page }) => {
  await loginAsSeededStudent(page, POLLING_EMAIL)
  const scope = { userEmail: POLLING_EMAIL }
  await submitAndWait(page.request, POLLING_EMAIL)

  await runVerifyPollTick(page.request, scope)
  await runVerifyPollTick(page.request, scope)
  // Nothing ripens a mock submission on its own, so no worker or spec could have moved this.
  expect((await myRegistrationOnCourse(page.request, SUOTAR_COURSE_SLUG)).state).toBe(
    "awaiting_verification",
  )

  await transitionMockSuotarSubmissionsFor(
    page.request,
    POLLING_STUDENT_NUMBER,
    "registered",
    CRS_101,
  )
  await runVerifyPollTick(page.request, scope)
  const registered = await waitForRegistrationState(page.request, SUOTAR_COURSE_SLUG, [
    "registered",
  ])
  expect(registered.student_facing_status).toBe("registered")
})

test("A reversal in Sisu is its own failure, not a silent return to waiting", async ({ page }) => {
  await loginAsSeededStudent(page, MISREGISTERED_EMAIL)
  const scope = { userEmail: MISREGISTERED_EMAIL }
  await submitAndWait(page.request, MISREGISTERED_EMAIL)

  await transitionMockSuotarSubmissionsFor(
    page.request,
    MISREGISTERED_STUDENT_NUMBER,
    "misregistered",
    CRS_101,
  )
  await runVerifyPollTick(page.request, scope)
  const reversed = await waitForRegistrationState(page.request, SUOTAR_COURSE_SLUG, [
    "misregistered",
  ])
  expect(reversed.student_facing_status).toBe("failed")
  expect(reversed.error_code).toBe("misregistered")

  await test.step("A reversed row is not polled again", async () => {
    const before = await countMockCallsForStudent(
      page.request,
      MISREGISTERED_STUDENT_NUMBER,
      "verify_attainments",
    )
    await runVerifyPollTick(page.request, scope)
    await runVerifyPollTick(page.request, scope)
    // Only a human moves a row the study registry reversed, so a poller that keeps asking is the
    // failure mode, and it is silent.
    expect(
      await countMockCallsForStudent(
        page.request,
        MISREGISTERED_STUDENT_NUMBER,
        "verify_attainments",
      ),
    ).toBe(before)
  })
})
