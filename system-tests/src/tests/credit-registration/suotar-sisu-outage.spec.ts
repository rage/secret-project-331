import {
  CREDIT_REGISTRATION_STUDENT_4,
  CRS_B_101,
  SUOTAR_B_COURSE_ID,
  SUOTAR_B_COURSE_SLUG,
} from "@/utils/creditRegistration"
import {
  errorsByCode,
  listAdminRegistrations,
  makeRegistrationDueNow,
} from "@/utils/creditRegistrationAdmin"
import {
  applyMockSuotarScenario,
  armMockSuotarFault,
  disarmMockSuotarFault,
  transitionMockSuotarSubmissionsFor,
} from "@/utils/mockSuotar"
import { ADMIN_STORAGE_STATE, expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import {
  runImportSubmissionTick,
  runMaterializeTick,
  runPreconditionsTick,
  runResolveEnrolmentsTick,
  runTickUnchecked,
  runVerifyPollTick,
  setTestExclusiveHold,
} from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/**
 * Owns `credit-registration-student-4` on `via-suotar-b`.
 *
 * The outage is armed on one student number and course code — a global fault would trip the alert
 * banner on every other spec, so the dashboard assertions here can only be about this row's own
 * code. Every tick afterward names the row by id, since a failing iteration counts against the
 * circuit breaker of whatever scope ran it.
 *
 * Deliberately not covered here: the "too many attempts" attention-table reason. That reason and
 * `breaker::MAX_CONSECUTIVE_SUOTAR_FAILURES` share the same threshold (5), so reaching it here would
 * mean racing this scope's own circuit breaker with zero margin. Two retries is enough to prove a
 * transient code is never treated as final.
 */
test.use({ storageState: ADMIN_STORAGE_STATE })

const OUTAGE_STUDENT_NUMBER = CREDIT_REGISTRATION_STUDENT_4.studentNumber
const OUTAGE_EMAIL = CREDIT_REGISTRATION_STUDENT_4.email
const OUTAGE_FAULT_ID = "sisu-outage-spec"
const IMPORT_OUTAGE_FAULT_ID = "sisu-outage-spec-import"
const OUTAGE_FIRST_NAMES = "Zzyzx"
const OUTAGE_LAST_NAME = CREDIT_REGISTRATION_STUDENT_4.lastName
const OUTAGE_SISU_EMAIL = "zzyzx.crsfour@helsinki.example"
const UNAVAILABLE_WIRE_CODE = "serviceTemporarilyUnavailable"
const UNAVAILABLE_LEDGER_CODE = "service_temporarily_unavailable"
/** Renewed every retry pass, so this only has to cover the gap between two passes, not the whole spec. */
const HOLD_SECS = 60
/** Well under `breaker::MAX_CONSECUTIVE_SUOTAR_FAILURES` (5), so the retries never trip it. */
const RETRY_PASSES = 2

const outageRow = async (adminApi: Parameters<typeof listAdminRegistrations>[0]) => {
  const page = await listAdminRegistrations(adminApi, {
    student_number: OUTAGE_STUDENT_NUMBER,
    course_id: SUOTAR_B_COURSE_ID,
  })
  return page.data[0] ?? null
}

// The fault lives in the shared mock, not in this test's scope, so a failure before the last step
// would leave `resolve_enrolments` refusing this student number for every later spec and every
// re-run. Disarming is idempotent, and the last step disarms on its own as part of what it asserts.
test.afterEach(async ({ page }) => {
  await disarmMockSuotarFault(page.request, OUTAGE_FAULT_ID)
  await disarmMockSuotarFault(page.request, IMPORT_OUTAGE_FAULT_ID)
})

test("An outage backs off, surfaces on the errors tab, and recovers", async ({
  page,
  adminApi,
}) => {
  const scope = { userEmail: OUTAGE_EMAIL, courseSlug: SUOTAR_B_COURSE_SLUG }

  // Armed before the enrolment exists, so no unscoped worker sweep can resolve this row while the
  // study registry is still answering normally. `resolve` is pre-write: nothing lands in the
  // registry, which is what makes the code honestly transient.
  await armMockSuotarFault(page.request, {
    id: OUTAGE_FAULT_ID,
    when: [
      { endpoint: "resolve_enrolments" },
      { stage: "resolve" },
      { studentNumber: OUTAGE_STUDENT_NUMBER },
      { courseCode: CRS_B_101 },
    ],
    // oxlint-disable-next-line unicorn/no-thenable -- `when`/`then` is the mock's own fault shape
    then: { kind: "requestLevel", status: 503, code: UNAVAILABLE_WIRE_CODE },
  })
  await applyMockSuotarScenario(page.request, "happy-path", {
    studentNumber: OUTAGE_STUDENT_NUMBER,
    courseCode: CRS_B_101,
    owner: { user: OUTAGE_EMAIL, course: SUOTAR_B_COURSE_SLUG },
    firstNames: OUTAGE_FIRST_NAMES,
    lastName: OUTAGE_LAST_NAME,
    primaryEmail: OUTAGE_SISU_EMAIL,
  })

  // Before materialize, not after: the live background worker ticks preconditions/resolve-enrolments
  // every 10s regardless of this test, so a hold set only once the row exists would still race the
  // worker's own next tick. Held by identity instead, so the row is born already excused.
  await setTestExclusiveHold(page.request, OUTAGE_EMAIL, HOLD_SECS, SUOTAR_B_COURSE_ID)
  await runMaterializeTick(page.request, scope)
  const materialized = await outageRow(adminApi)
  expect(materialized).not.toBeNull()
  const rowScope = { creditRegistrationIds: [materialized!.id] }
  // The completion behind this row is seeded eligible, so the live credit-registrar worker has
  // been ticking it since long before this spec started. If it reached resolve-enrolments before
  // the scenario above created the mock enrolment, the row is now parked in `no_usable_enrolment`
  // under a long backoff (see suotar-import-outcomes.spec.ts for the same hazard). Forcing it due
  // now is a no-op for a fresh row and the only way to unstick a backfilled one.
  await makeRegistrationDueNow(adminApi, materialized!.id)
  await runPreconditionsTick(page.request, rowScope)
  // Unchecked: the outage makes this iteration fail by construction, so the tick reports a
  // phase-level error of its own.
  await runTickUnchecked(page.request, "resolve-enrolments", rowScope)

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
      // Renewed every pass so a slow run can never let the hold lapse before the row is disarmed.
      await setTestExclusiveHold(page.request, OUTAGE_EMAIL, HOLD_SECS, SUOTAR_B_COURSE_ID)
      // A backoff-expired `failed_retryable` row resumes through `preconditions`, back to
      // `ready_to_submit`, before `resolve-enrolments` can claim and fail it again.
      await runPreconditionsTick(page.request, rowScope)
      await runTickUnchecked(page.request, "resolve-enrolments", rowScope)
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

  await test.step("A 503 on import is retried rather than left uncertain", async () => {
    // Suotar answers 503 before it sends anything, so unlike a timeout nothing can have landed.
    await armMockSuotarFault(page.request, {
      id: IMPORT_OUTAGE_FAULT_ID,
      when: [
        { endpoint: "import_attainments" },
        { stage: "resolve" },
        { studentNumber: OUTAGE_STUDENT_NUMBER },
        { courseCode: CRS_B_101 },
      ],
      // oxlint-disable-next-line unicorn/no-thenable -- `when`/`then` is the mock's own fault shape
      then: { kind: "requestLevel", status: 503, code: UNAVAILABLE_WIRE_CODE },
    })
    await disarmMockSuotarFault(page.request, OUTAGE_FAULT_ID)
    await makeRegistrationDueNow(adminApi, failing.id)
    await setTestExclusiveHold(page.request, OUTAGE_EMAIL, HOLD_SECS, SUOTAR_B_COURSE_ID)
    // Resumes through `preconditions` to `ready_to_submit`, and `resolve-enrolments` now succeeds
    // and freezes the payload.
    await runPreconditionsTick(page.request, rowScope)
    await runResolveEnrolmentsTick(page.request, rowScope)
    await runTickUnchecked(page.request, "import", rowScope)

    const retrying = await pollUntil(
      async () => {
        const row = await outageRow(adminApi)
        return row?.state === "failed_retryable" && row.selected_enrolment_id !== null ? row : null
      },
      { description: "the outage row to wait for another import" },
    )
    expect(retrying.error_code).toBe(UNAVAILABLE_LEDGER_CODE)
  })

  await test.step("The row registers once the study registry answers again", async () => {
    await disarmMockSuotarFault(page.request, IMPORT_OUTAGE_FAULT_ID)
    await makeRegistrationDueNow(adminApi, failing.id)
    // The payload is frozen, so `preconditions` resumes the row at `checking_enrolment` and
    // `import` sends it. Well under the circuit breaker's failure limit, so this runs cleanly on
    // the first attempt.
    await runPreconditionsTick(page.request, rowScope)
    await runImportSubmissionTick(page.request, rowScope)

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
      CRS_B_101,
    )
    await makeRegistrationDueNow(adminApi, submitted.id)
    await runVerifyPollTick(page.request, rowScope)

    await pollUntil(
      async () => {
        const row = await outageRow(adminApi)
        return row?.state === "registered" ? row : null
      },
      { description: "the outage row to reach the study registry" },
    )
  })
})
