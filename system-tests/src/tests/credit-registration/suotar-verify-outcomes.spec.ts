import {
  countMockCallsForStudent,
  CRS_101,
  myRegistrationOnCourse,
  seededStudentStorageState,
  SUOTAR_COURSE_SLUG,
  waitForRegistrationState,
} from "@/utils/creditRegistration"
import { adminRegistrationDetails, makeRegistrationDueNow } from "@/utils/creditRegistrationAdmin"
import { transitionMockSuotarSubmissionsFor } from "@/utils/mockSuotar"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import { runPhasesUpToSubmission, runVerifyPollTick } from "@/utils/suotarControl"

/**
 * Needs the single-phase `verify` tick so verification runs twice without re-running the import.
 * Owns student numbers `9000005xx`.
 */
const POLLING_EMAIL = "credit-registration-verify-polling@example.com"
const POLLING_STUDENT_NUMBER = "900000501"
const MISREGISTERED_EMAIL = "credit-registration-verify-misregistered@example.com"
const MISREGISTERED_STUDENT_NUMBER = "900000502"
const NOT_REGISTERED_EMAIL = "credit-registration-verify-not-registered@example.com"
const NOT_REGISTERED_STUDENT_NUMBER = "900000503"

test.describe("A submission the study registry has not answered yet", () => {
  test.use({ storageState: seededStudentStorageState(POLLING_EMAIL) })

  test("Polling stays in waiting until Sisu confirms, then flips to registered", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: POLLING_EMAIL }
    await runPhasesUpToSubmission(page.request, scope)
    const submitted = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "awaiting_verification",
    ])

    await makeRegistrationDueNow(adminApi, submitted.id)
    await runVerifyPollTick(page.request, scope)

    await test.step("A pending submission is polled again soon but not resubmitted", async () => {
      const { registration } = await adminRegistrationDetails(adminApi, submitted.id)
      // The mock answers `submissionPending` with a `retryAfter` a day out, like Suotar does.
      const hoursUntilNextPoll =
        (new Date(registration.next_attempt_at).getTime() - Date.now()) / 3_600_000
      expect(hoursUntilNextPoll).toBeLessThan(1)
      expect(registration.resubmission_refusal).toBe("submission_pending")
    })

    await makeRegistrationDueNow(adminApi, submitted.id)
    await runVerifyPollTick(page.request, scope)
    // Only a control transition moves a mock submission, so no worker or spec could have moved this.
    expect((await myRegistrationOnCourse(page.request, adminApi, SUOTAR_COURSE_SLUG)).state).toBe(
      "awaiting_verification",
    )

    await test.step("Only the assessment item attainment is not yet a registration", async () => {
      await transitionMockSuotarSubmissionsFor(
        page.request,
        POLLING_STUDENT_NUMBER,
        "partiallyRegistered",
        CRS_101,
      )
      const pollsBefore = await countMockCallsForStudent(
        page.request,
        POLLING_STUDENT_NUMBER,
        "verify_attainments",
      )
      await makeRegistrationDueNow(adminApi, submitted.id)
      await runVerifyPollTick(page.request, scope)
      expect(
        await countMockCallsForStudent(page.request, POLLING_STUDENT_NUMBER, "verify_attainments"),
      ).toBeGreaterThan(pollsBefore)
      expect((await myRegistrationOnCourse(page.request, adminApi, SUOTAR_COURSE_SLUG)).state).toBe(
        "awaiting_verification",
      )
    })

    await transitionMockSuotarSubmissionsFor(
      page.request,
      POLLING_STUDENT_NUMBER,
      "registered",
      CRS_101,
    )
    await makeRegistrationDueNow(adminApi, submitted.id)
    await runVerifyPollTick(page.request, scope)
    const registered = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "registered",
    ])
    expect(registered.student_facing_status).toBe("registered")
  })
})

test.describe("A submission the study registry reversed after accepting it", () => {
  test.use({ storageState: seededStudentStorageState(MISREGISTERED_EMAIL) })

  test("A reversal in Sisu is its own failure, not a silent return to waiting", async ({
    page,
    adminApi,
  }) => {
    const scope = { userEmail: MISREGISTERED_EMAIL }
    await runPhasesUpToSubmission(page.request, scope)
    const submitted = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "awaiting_verification",
    ])

    await transitionMockSuotarSubmissionsFor(
      page.request,
      MISREGISTERED_STUDENT_NUMBER,
      "misregistered",
      CRS_101,
    )
    await makeRegistrationDueNow(adminApi, submitted.id)
    await runVerifyPollTick(page.request, scope)
    const reversed = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
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
      // Due, so what stops the polling is the state the row is in rather than a backoff.
      await makeRegistrationDueNow(adminApi, submitted.id)
      await runVerifyPollTick(page.request, scope)
      await runVerifyPollTick(page.request, scope)
      // Only a human moves a row the study registry reversed, so a poller that keeps
      // asking fails silently.
      expect(
        await countMockCallsForStudent(
          page.request,
          MISREGISTERED_STUDENT_NUMBER,
          "verify_attainments",
        ),
      ).toBe(before)
    })
  })
})

test.describe("A submission the study registry lost", () => {
  test.use({ storageState: seededStudentStorageState(NOT_REGISTERED_EMAIL) })

  test("A lost submission is retried and sent a second time", async ({ page, adminApi }) => {
    const scope = { userEmail: NOT_REGISTERED_EMAIL }
    await runPhasesUpToSubmission(page.request, scope)
    const submitted = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "awaiting_verification",
    ])
    expect(
      await countMockCallsForStudent(
        page.request,
        NOT_REGISTERED_STUDENT_NUMBER,
        "import_attainments",
      ),
    ).toBe(1)

    await transitionMockSuotarSubmissionsFor(
      page.request,
      NOT_REGISTERED_STUDENT_NUMBER,
      "notRegistered",
      CRS_101,
    )
    await makeRegistrationDueNow(adminApi, submitted.id)
    await runVerifyPollTick(page.request, scope)
    const lost = await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
      "failed_retryable",
    ])
    expect(lost.error_code).toBe("not_registered")

    await test.step("The next pass imports it again", async () => {
      await makeRegistrationDueNow(adminApi, lost.id)
      await runPhasesUpToSubmission(page.request, scope)
      await waitForRegistrationState(page.request, adminApi, SUOTAR_COURSE_SLUG, [
        "awaiting_verification",
      ])
      expect(
        await countMockCallsForStudent(
          page.request,
          NOT_REGISTERED_STUDENT_NUMBER,
          "import_attainments",
        ),
      ).toBe(2)
    })
  })
})
