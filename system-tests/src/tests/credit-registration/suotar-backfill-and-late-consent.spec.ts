import {
  BACKFILL_COURSE_ID,
  BACKFILL_COURSE_SLUG,
  myRegistrationOnCourse,
  ORIGIN,
  PROFILE_CREDIT_REGISTRATION_URL,
  seededStudentStorageState,
} from "@/utils/creditRegistration"
import { listAdminRegistrations } from "@/utils/creditRegistrationAdmin"
import { ADMIN_STORAGE_STATE, expect, testThatCanFail as test } from "@/utils/nonBlockingTest"
import { runMaterializeTick, runPreconditionsTick } from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/**
 * Owns the `credit-registration-backfill` course outright and student numbers `9000011xx`. Turning the
 * flag on is a one-way, run-wide change that materialises a row for every student on the course, so
 * this file is serial and no other spec may touch that course or assert on the resulting wave.
 * `retries: 0` follows: a retry replays the group from the test that flips the flag, which by then is
 * already on, so retrying only turns one failure into three.
 */
test.describe.configure({ mode: "serial", retries: 0 })

const MODULES_URL = `${ORIGIN}/manage/courses/${BACKFILL_COURSE_ID}/modules`
const REALISATION_ID = "hy-opt-cur-crs-backfill-101-degree"

/** Four passed completions, one of them already in the legacy ledger, plus one that failed. */
const ALREADY_REGISTERED_EMAIL = "credit-registration-backfill-1@example.com"
const LATE_CONSENT_EMAIL = "credit-registration-backfill-2@example.com"
const FAILED_COMPLETION_EMAIL = "credit-registration-backfill-failed@example.com"

test.describe("The teacher opts the module in", () => {
  test.use({ storageState: ADMIN_STORAGE_STATE })

  test("Opting the module in enqueues its history and skips what is already registered", async ({
    page,
  }) => {
    await page.goto(MODULES_URL)
    const moduleForm = page.locator('form:has-text("Default module")')
    await moduleForm.getByRole("button", { name: "Edit" }).click()
    await page.getByLabel("Register completions to the study registry automatically").check()
    // The realisation list starts empty, and a module with no realisation is never listed.
    await page.getByRole("button", { name: "Add realisation" }).click()
    await page.getByLabel("Realisation id").last().fill(REALISATION_ID)
    // Confirm: this module's own inline save, ambiguous with the "create module" panel's disabled
    // one below it. Save changes: the page-level submit that actually persists it.
    await moduleForm.getByLabel("Confirm").click()
    await page.getByRole("button", { name: "Save changes" }).click()
    await expect(page.getByText("Success").first()).toBeVisible()

    await runMaterializeTick(page.request, { courseSlug: BACKFILL_COURSE_SLUG })
    // Materialize only creates the rows; ticking preconditions ourselves is what moves them out of
    // `pending_prerequisites` — waiting on the background worker's own schedule instead made this
    // flaky.
    await runPreconditionsTick(page.request, { courseSlug: BACKFILL_COURSE_SLUG })

    const rows = await pollUntil(
      async () => {
        const listed = await listAdminRegistrations(page.request, {
          course_id: BACKFILL_COURSE_ID,
          limit: 50,
        })
        const settled = listed.data.every((row) => row.state !== "pending_prerequisites")
        return listed.total_count > 0 && settled ? listed : null
      },
      { description: "the backfill wave to materialise and settle" },
    )

    // Three, not four: re-pushing a course's whole history is what this predicate prevents,
    // and a row that ends up `duplicate` is no substitute for never existing. The failed
    // completion waits for nothing either.
    expect(rows.total_count).toBe(3)
    const emails = rows.data.map((row) => row.email)
    expect(emails).not.toContain(ALREADY_REGISTERED_EMAIL)
    expect(emails).not.toContain(FAILED_COMPLETION_EMAIL)
    // Nobody has been asked yet, so a backfill submits nothing.
    expect(new Set(rows.data.map((row) => row.state))).toStrictEqual(new Set(["pending_consent"]))
  })
})

test.describe("A student consenting after the fact", () => {
  test.use({ storageState: seededStudentStorageState(LATE_CONSENT_EMAIL) })

  test("Late consent from the profile page unblocks the backfilled rows", async ({
    page,
    adminApi,
  }) => {
    await page.goto(PROFILE_CREDIT_REGISTRATION_URL)

    const allow = page.getByRole("button", { name: /^Allow/ })
    await expect(allow).toBeVisible()
    await allow.click()

    // The count is the whole point of asking late: the student is told what consenting will do.
    await expect(page.getByTestId("credit-registration-newly-unblocked")).toBeVisible()

    await runPreconditionsTick(page.request, { userEmail: LATE_CONSENT_EMAIL })
    const unblocked = await pollUntil(
      async () => {
        const row = await myRegistrationOnCourse(page.request, adminApi, BACKFILL_COURSE_SLUG)
        return row.state !== "pending_consent" ? row : null
      },
      { description: "the backfilled row to leave pending_consent" },
    )
    expect(["pending_student_number", "ready_to_submit", "checking_enrolment"]).toContain(
      unblocked.state,
    )
  })
})
