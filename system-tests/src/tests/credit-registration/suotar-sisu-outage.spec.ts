import { CRS_101, SUOTAR_COURSE_SLUG } from "@/utils/creditRegistration"
import {
  errorsByCode,
  listAdminRegistrations,
  makeRegistrationDueNow,
} from "@/utils/creditRegistrationAdmin"
import { ADMIN_STORAGE_STATE, expect, test } from "@/utils/fixtures"
import {
  applyMockSuotarScenario,
  armMockSuotarFault,
  disarmMockSuotarFault,
  transitionMockSuotarSubmissionsFor,
} from "@/utils/mockSuotar"
import {
  runImportSubmissionTick,
  runMaterializeTick,
  runPreconditionsTick,
  runResolveEnrolmentsTick,
  runTickUnchecked,
  runVerifyPollTick,
} from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/**
 * Owns student numbers `9000006xx`.
 *
 * The outage is armed on this one student number. A global one would raise a critical banner on
 * every spec running beside this file, and the alert rules are global by design — so the dashboard
 * assertions here are the part attributable to this row: the code it produced.
 *
 * Deliberately not covered here: the "too many attempts" attention-table reason. That reason and
 * `breaker::MAX_CONSECUTIVE_SUOTAR_FAILURES` share the same threshold (5), so reaching it here would
 * mean racing this scope's own circuit breaker with zero margin. Two retries is enough to prove a
 * transient code is never treated as final.
 */
test.use({ storageState: ADMIN_STORAGE_STATE })

const OUTAGE_STUDENT_NUMBER = "900000601"
const OUTAGE_EMAIL = "credit-registration-sisu-outage@example.com"
const OUTAGE_FAULT_ID = "sisu-outage-spec"
const OUTAGE_FIRST_NAMES = "Zzyzx"
const OUTAGE_LAST_NAME = "Outaged"
const OUTAGE_SISU_EMAIL = "zzyzx.outaged@helsinki.example"
const UNAVAILABLE_WIRE_CODE = "sisuTemporarilyUnavailable"
const UNAVAILABLE_LEDGER_CODE = "sisu_temporarily_unavailable"
/** Well under `breaker::MAX_CONSECUTIVE_SUOTAR_FAILURES` (5), so the retries never trip it. */
const RETRY_PASSES = 2

const outageRow = async (adminApi: Parameters<typeof listAdminRegistrations>[0]) => {
  const page = await listAdminRegistrations(adminApi, { student_number: OUTAGE_STUDENT_NUMBER })
  return page.data[0] ?? null
}

// The fault lives in the shared mock, not in this test's scope, so a failure before the last step
// would leave `resolve_enrolments` refusing this student number for every later spec and every
// re-run. Disarming is idempotent, and the last step disarms on its own as part of what it asserts.
test.afterEach(async ({ page }) => {
  await disarmMockSuotarFault(page.request, OUTAGE_FAULT_ID)
})

test("An outage backs off, surfaces on the errors tab, and recovers", async ({
  page,
  adminApi,
}) => {
  const scope = { userEmail: OUTAGE_EMAIL }

  // `import` hardens a request-level failure to `submission_uncertain` rather than
  // `failed_retryable`, since a request Suotar never answered may still have landed and a retry
  // would double-submit. `resolve-enrolments` carries no such risk — nothing is created there — so
  // its outcome for the same wire code is the one this spec needs: `failed_retryable`, retried
  // rather than given up on.
  //
  // Armed before the enrolment exists, so no unscoped worker sweep can resolve this row while the
  // study registry is still answering normally. `resolve` is pre-write: nothing lands in the
  // registry, which is what makes the code honestly transient.
  await armMockSuotarFault(page.request, {
    id: OUTAGE_FAULT_ID,
    when: [
      { endpoint: "resolve_enrolments" },
      { stage: "resolve" },
      { studentNumber: OUTAGE_STUDENT_NUMBER },
    ],
    // oxlint-disable-next-line unicorn/no-thenable -- `when`/`then` is the mock's own fault shape
    then: { kind: "requestLevel", status: 503, code: UNAVAILABLE_WIRE_CODE },
  })
  await applyMockSuotarScenario(page.request, "happy-path", {
    studentNumber: OUTAGE_STUDENT_NUMBER,
    courseCode: CRS_101,
    owner: { user: OUTAGE_EMAIL, course: SUOTAR_COURSE_SLUG },
    firstNames: OUTAGE_FIRST_NAMES,
    lastName: OUTAGE_LAST_NAME,
    primaryEmail: OUTAGE_SISU_EMAIL,
  })

  await runMaterializeTick(page.request, scope)
  await runPreconditionsTick(page.request, scope)
  // Unchecked: the outage makes this iteration fail by construction, so the tick reports a
  // phase-level error of its own.
  await runTickUnchecked(page.request, "resolve-enrolments", scope)

  const failing = await pollUntil(
    async () => {
      const row = await outageRow(adminApi)
      return row?.state === "failed_retryable" ? row : null
    },
    { description: "the outage row to be waiting for a retry" },
  )
  expect(failing.error_code).toBe(UNAVAILABLE_LEDGER_CODE)

  await test.step("Repeated passes retry rather than give up", async () => {
    for (let pass = 0; pass < RETRY_PASSES; pass++) {
      await makeRegistrationDueNow(adminApi, failing.id)
      // A backoff-expired `failed_retryable` row resumes through `preconditions`, back to
      // `ready_to_submit`, before `resolve-enrolments` can claim and fail it again.
      await runPreconditionsTick(page.request, scope)
      await runTickUnchecked(page.request, "resolve-enrolments", scope)
    }
    const row = await outageRow(adminApi)
    // A transient code must never be treated as final, however many passes it survives.
    expect(row?.state).toBe("failed_retryable")
    expect(row?.submit_retry_count).toBeGreaterThan(1)
  })

  await test.step("The errors tab counts the code", async () => {
    const codes = await errorsByCode(adminApi)
    const unavailable = codes.codes.find((row) => row.error_code === UNAVAILABLE_LEDGER_CODE)
    expect(unavailable?.current_count ?? 0).toBeGreaterThan(0)
    expect(unavailable?.retryability).toBe("retryable_transient")
  })

  await test.step("The row registers once the study registry answers again", async () => {
    await disarmMockSuotarFault(page.request, OUTAGE_FAULT_ID)
    await makeRegistrationDueNow(adminApi, failing.id)
    // Resumes through `preconditions` to `ready_to_submit`, then `resolve-enrolments` succeeds now
    // that the outage is lifted and freezes the payload, before `import` can submit it. Well under
    // the circuit breaker's failure limit, so this runs cleanly on the first attempt.
    await runPreconditionsTick(page.request, scope)
    await runResolveEnrolmentsTick(page.request, scope)
    await runImportSubmissionTick(page.request, scope)

    const submitted = await pollUntil(
      async () => {
        const row = await outageRow(adminApi)
        return row?.state === "awaiting_verification" ? row : null
      },
      { description: "the outage row to be submitted once the outage lifts" },
    )
    await transitionMockSuotarSubmissionsFor(
      page.request,
      OUTAGE_STUDENT_NUMBER,
      "registered",
      CRS_101,
    )
    await makeRegistrationDueNow(adminApi, submitted.id)
    await runVerifyPollTick(page.request, scope)

    await pollUntil(
      async () => {
        const row = await outageRow(adminApi)
        return row?.state === "registered" ? row : null
      },
      { description: "the outage row to reach the study registry" },
    )
  })
})
