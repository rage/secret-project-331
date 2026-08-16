import { CRS_101, ORIGIN, SUOTAR_COURSE_SLUG } from "@/utils/creditRegistration"
import {
  attentionItems,
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
  runVerifyPollTick,
} from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/**
 * Owns student numbers `9000006xx`.
 *
 * The outage is armed on this one student number. A global one would raise a critical banner on
 * every spec running beside this file, and the alert rules are global by design — so the dashboard
 * assertions here are the part attributable to this row: the code it produced, and the row itself on
 * the attention table. The banner is deliberately not asserted.
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
const ERRORS_URL = `${ORIGIN}/manage/credit-registration/errors`
/** Enough passes that a row treating a transient code as final would already have given up. */
const RETRY_PASSES = 5

const outageRow = async (adminApi: Parameters<typeof listAdminRegistrations>[0]) => {
  const page = await listAdminRegistrations(adminApi, { student_number: OUTAGE_STUDENT_NUMBER })
  return page.data[0] ?? null
}

test("An outage backs off, surfaces on the errors tab, and recovers", async ({
  page,
  adminApi,
}) => {
  const scope = { userEmail: OUTAGE_EMAIL }

  // Armed before the enrolment exists, so no unscoped worker sweep can import this row while the
  // study registry is still answering normally. `resolve` is pre-write: nothing lands in the
  // registry, which is what makes the code honestly transient.
  await armMockSuotarFault(page.request, {
    id: OUTAGE_FAULT_ID,
    when: [
      { endpoint: "import_attainments" },
      { stage: "resolve" },
      { studentNumber: OUTAGE_STUDENT_NUMBER },
    ],
    // oxlint-disable-next-line unicorn/no-thenable -- `when`/`then` is the mock's own fault shape
    then: { kind: "itemLevel", code: UNAVAILABLE_WIRE_CODE },
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
  await runResolveEnrolmentsTick(page.request, scope)
  await runImportSubmissionTick(page.request, scope)

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
      await runImportSubmissionTick(page.request, scope)
    }
    const row = await outageRow(adminApi)
    // A transient code must never be treated as final, however many passes it survives.
    expect(row?.state).toBe("failed_retryable")
    expect(row?.submit_retry_count).toBeGreaterThan(1)
  })

  await test.step("The errors tab counts the code and lists the row", async () => {
    const codes = await errorsByCode(adminApi)
    const unavailable = codes.codes.find((row) => row.error_code === UNAVAILABLE_LEDGER_CODE)
    expect(unavailable?.current_count ?? 0).toBeGreaterThan(0)
    expect(unavailable?.retryability).toBe("retryable_transient")

    const attention = await pollUntil(
      async () => {
        const items = await attentionItems(adminApi)
        const mine = items.items.find((item) => item.credit_registration_id === failing.id)
        return mine?.reasons.includes("too_many_attempts") ? mine : null
      },
      { description: "the retried row to reach the attention table" },
    )
    expect(attention.error_code).toBe(UNAVAILABLE_LEDGER_CODE)

    await page.goto(ERRORS_URL)
    await expect(page.getByRole("heading", { name: "Needs a human" })).toBeVisible()
    await expect(page.getByText("Too many attempts").first()).toBeVisible()
  })

  await test.step("The row registers once the study registry answers again", async () => {
    await disarmMockSuotarFault(page.request, OUTAGE_FAULT_ID)
    await makeRegistrationDueNow(adminApi, failing.id)
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
