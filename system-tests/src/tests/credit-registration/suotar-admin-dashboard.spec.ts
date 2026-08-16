import { expect, test } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import {
  ADMIN_COURSE_ID,
  ADMIN_COURSE_SLUG,
  CRS_ADMIN_101,
  ORIGIN,
} from "@/utils/creditRegistration"
import {
  accountLinkingStats,
  adminOverview,
  adminRegistrationDetails,
  listAdminRegistrations,
  makeRegistrationDueNow,
  pausePhase,
  postAdminManualLink,
  postAdminPhaseAction,
  resumePhase,
  runPhaseNow,
} from "@/utils/creditRegistrationAdmin"
import { ADMIN_STORAGE_STATE } from "@/utils/fixtures"
import { transitionMockSuotarSubmissionsFor } from "@/utils/mockSuotar"
import {
  CREDIT_REGISTRATION_PHASES,
  runEnrolmentDiscoveryTick,
  runLinkEmailsTick,
  runPhasesUpToSubmission,
  runTickUnchecked,
  runVerifyPollTick,
} from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/**
 * Owns student numbers `9000009xx` and the `credit-registration-admin` course, the only course this
 * file ticks: discovery and the linking mails scope by course alone, so ticking them anywhere else
 * would sweep another spec's students.
 *
 * Aggregate tiles are global and run-order dependent, so nothing here asserts a dashboard total.
 */
test.use({ storageState: ADMIN_STORAGE_STATE })

const OVERVIEW_URL = `${ORIGIN}/manage/credit-registration/overview`
const REGISTRATIONS_URL = `${ORIGIN}/manage/credit-registration/registrations`
const LINKING_URL = `${ORIGIN}/manage/credit-registration/linking`

/** The seeded attempt chain: a registered grade 3 replaced by a registered grade 4. */
const SUPERSEDED_ATTEMPT_1_ID = "c5ed17ea-0901-4a5e-9e6e-c0de00000901"
const SUPERSEDED_ATTEMPT_2_ID = "c5ed17ea-0902-4a5e-9e6e-c0de00000902"

const SUPERSEDED_STUDENT_NUMBER = "900000901"

const STALE_STUDENT_NUMBER = "900000903"
const STALE_ADDRESS = "zzyzx.deadaddress@helsinki.example"
// Anchored: "old." and "older." variants of the same address also carry STALE_ADDRESS as a
// substring, so a plain text match resolves to all three list items instead of just this one.
const STALE_ADDRESS_EXACT = new RegExp(
  `^${STALE_ADDRESS.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
)

/** Consented and linked from seed time, so it is the one row on this course a tick can register. */
const ADMIN_LINKED_EMAIL = "credit-registration-admin-linked@example.com"
const ADMIN_LINKED_STUDENT_NUMBER = "900000904"
const ADMIN_LINKED_LAST_NAME = "Alreadylinked"
const ADMIN_LINKED_SISU_EMAIL = "zzyzx.alreadylinked@helsinki.example"

test("The three shipped tabs render, and the phases report heartbeats", async ({ page }) => {
  await page.goto(OVERVIEW_URL)
  await expect(page.getByRole("heading", { level: 1, name: "Credit registration" })).toBeVisible()
  for (const name of ["Overview", "Registrations", "Account linking"]) {
    await expect(page.getByRole("tab", { name })).toBeVisible()
  }
  await expect(page.getByRole("heading", { name: "Where registrations stand" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Pipeline phases" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Study registry" })).toBeVisible()
  await accessibilityCheck(page, "Credit registration admin overview")

  await test.step("Both worker programs are alive and stamping their phases", async () => {
    const overview = await adminOverview(page.request)
    expect(overview.phases).toHaveLength(CREDIT_REGISTRATION_PHASES.length)
    for (const processName of ["credit-registrar", "suotar-syncer"]) {
      const owned = overview.phases.filter((phase) => phase.process_name === processName)
      expect(owned.length, `${processName} owns no phases`).toBeGreaterThan(0)
      expect(
        owned.some((phase) => phase.last_heartbeat_at !== null),
        `${processName} has never reported a heartbeat`,
      ).toBe(true)
    }
  })

  await page.getByRole("tab", { name: "Registrations" }).click()
  await expect(page.getByRole("table", { name: "Registrations" })).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "State", exact: true })).toBeVisible()

  await page.getByRole("tab", { name: "Account linking" }).click()
  await expect(page.getByRole("heading", { name: "Account linking" }).first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "Per course realisation" })).toBeVisible()
})

// No other spec file ticks `enrolment-discovery`, so pausing it here cannot stall a concurrent tick
// of the globally-shared `credit_registration_phase_state` row.
test("Pausing a phase stops a tick, and resuming it lifts that again", async ({ page }) => {
  const phase = "enrolment-discovery"
  const pauseReason = "System test: proving the pause control works."

  await test.step("An unknown phase name is refused by all three actions", async () => {
    for (const action of ["pause", "resume", "run-now"] as const) {
      const response = await postAdminPhaseAction(
        page.request,
        "not-a-real-phase",
        action,
        pauseReason,
      )
      expect(response.status(), `${action} accepted an unknown phase name`).toBe(422)
    }
  })

  await test.step("Pausing without a reason is refused", async () => {
    const response = await postAdminPhaseAction(page.request, phase, "pause", "   ")
    expect(response.status()).toBe(422)
  })

  try {
    await test.step("Pausing takes effect immediately, and the overview reflects it", async () => {
      const paused = await pausePhase(page.request, phase, pauseReason)
      expect(paused.paused_at).not.toBeNull()
      expect(paused.pause_reason).toBe(pauseReason)

      const overview = await adminOverview(page.request)
      const row = overview.phases.find((candidate) => candidate.phase === phase)
      expect(row?.paused_at).not.toBeNull()
    })

    await test.step("A tick against the paused phase is skipped, not run", async () => {
      const result = await runTickUnchecked(page.request, phase, { courseSlug: ADMIN_COURSE_SLUG })
      expect(result).toMatchObject({ status: "skipped", reason: "paused" })
    })
  } finally {
    await test.step("Resuming lifts the pause", async () => {
      const resumed = await resumePhase(page.request, phase)
      expect(resumed.paused_at).toBeNull()
      expect(resumed.pause_reason).toBeNull()
    })
  }

  // `run-tick` calls `run_phase_once` directly and never consults `next_run_at`; only the real worker
  // loop does. So this proves the route answers, not that the phase was made due sooner.
  await test.step("Run-now is accepted for a known phase", async () => {
    expect(await runPhaseNow(page.request, phase)).toMatchObject({ phase })
  })
})

test("The explorer filters, and the attempt chain hides the replaced attempt by default", async ({
  page,
}) => {
  await page.goto(`${REGISTRATIONS_URL}?student_number=${SUPERSEDED_STUDENT_NUMBER}`)
  const table = page.getByRole("table", { name: "Registrations" })
  await expect(table.getByRole("row")).toHaveCount(2)

  await page.getByLabel("Show replaced attempts").check()
  await expect(table.getByRole("row")).toHaveCount(3)

  await page.goto(`${REGISTRATIONS_URL}/${SUPERSEDED_ATTEMPT_2_ID}`)
  await expect(page.getByRole("heading", { name: "Attempts for this completion" })).toBeVisible()
  await expect(
    page.getByText("A replaced attempt is shown for history only.", { exact: false }),
  ).toBeVisible()
  await accessibilityCheck(page, "Credit registration admin item detail")

  await test.step("A replaced attempt offers no actions", async () => {
    await page.goto(`${REGISTRATIONS_URL}/${SUPERSEDED_ATTEMPT_1_ID}`)
    await expect(page.getByText("This attempt has been replaced by a later one.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Move this registration" })).toHaveCount(0)
  })
})

test("No stored body carries a student number, a name or an email address", async ({ page }) => {
  const scope = { userEmail: ADMIN_LINKED_EMAIL }
  await runPhasesUpToSubmission(page.request, scope)
  // The mock's default ripeness is `manual`: nothing registers a submission without this.
  await transitionMockSuotarSubmissionsFor(
    page.request,
    ADMIN_LINKED_STUDENT_NUMBER,
    "registered",
    CRS_ADMIN_101,
  )
  const submitted = await pollUntil(
    async () => {
      const listed = await listAdminRegistrations(page.request, {
        student_number: ADMIN_LINKED_STUDENT_NUMBER,
        state: "awaiting_verification",
      })
      return listed.data[0] ?? null
    },
    { description: "the always-linked admin-course fixture to be submitted" },
  )
  await makeRegistrationDueNow(page.request, submitted.id)
  await runVerifyPollTick(page.request, scope)

  const registered = await pollUntil(
    async () => {
      const listed = await listAdminRegistrations(page.request, {
        student_number: ADMIN_LINKED_STUDENT_NUMBER,
        state: "registered",
      })
      return listed.data[0] ?? null
    },
    { description: "the always-linked admin-course fixture to register" },
  )

  const details = await adminRegistrationDetails(page.request, registered.id)
  expect(
    details.suotar_api_calls.length,
    "no Suotar calls were logged for this registration",
  ).toBeGreaterThan(0)

  const stored = JSON.stringify([
    details.events.map((event) => event.details),
    details.suotar_api_calls.map((call) => [call.request_body_sample, call.response_body_sample]),
  ])
  // resolve-enrolments and import send only the bare student number; a name or an email would only
  // ever reach a stored body through resolve-persons, which this pipeline never calls.
  for (const secret of [
    ADMIN_LINKED_STUDENT_NUMBER,
    ADMIN_LINKED_LAST_NAME,
    ADMIN_LINKED_SISU_EMAIL,
  ]) {
    expect(stored, `a stored body carries ${secret}`).not.toContain(secret)
  }

  await test.step("The unredacted half is still there, so the panel is worth reading", async () => {
    // The scrubbing note is what tells an admin the gaps are deliberate; without it, an empty panel
    // and a redacted one look the same.
    await page.goto(`${REGISTRATIONS_URL}/${registered.id}`)
    await expect(page.getByRole("heading", { name: "What happened" })).toBeVisible()
    await expect(
      page.getByText("Names, student numbers and email addresses are redacted"),
    ).toBeVisible()
  })
})

test("Manual link is refused without a preview and without a reason", async ({ page }) => {
  await page.goto(LINKING_URL)
  const staleRow = page
    .getByRole("table", { name: "People mailed to the cap without a claim" })
    .getByRole("row")
    .filter({ hasText: STALE_STUDENT_NUMBER })
  await staleRow.getByRole("button", { name: "Student cannot receive our mail at all?" }).click()

  const dialog = page.getByRole("dialog").filter({ hasText: "Link a student number by hand" })
  const confirm = dialog.getByRole("button", { name: "Link this number by hand" })
  // Both gates matter: the preview is what proves the number belongs to the person on the phone, and
  // the reason is the only record of why support went around the mailed link.
  await expect(confirm).toBeDisabled()

  await test.step("The API refuses the same two ways", async () => {
    const withoutPreview = await postAdminManualLink(page.request, {
      user_id: "00000000-0000-0000-0000-000000000000",
      student_number: STALE_STUDENT_NUMBER,
      sisu_person_id: "",
      reason: "System test",
    })
    expect(withoutPreview.status()).toBe(422)

    const withoutReason = await postAdminManualLink(page.request, {
      user_id: "00000000-0000-0000-0000-000000000000",
      student_number: STALE_STUDENT_NUMBER,
      sisu_person_id: `hy-hlo-${STALE_STUDENT_NUMBER}`,
      reason: "   ",
    })
    expect(withoutReason.status()).toBe(422)
  })

  await test.step("A preview naming a different person is refused as a mismatch", async () => {
    const mismatched = await postAdminManualLink(page.request, {
      user_id: "00000000-0000-0000-0000-000000000000",
      student_number: STALE_STUDENT_NUMBER,
      sisu_person_id: "hy-hlo-somebody-else",
      reason: "System test: the preview named somebody else.",
    })
    await expect(mismatched).toBeOK()
    expect(await mismatched.json()).toMatchObject({ outcome: "preview_mismatch" })
  })
})

test("Admin resend can pass the rate cap with a reason", async ({ page }) => {
  await page.goto(LINKING_URL)
  const staleRow = page
    .getByRole("table", { name: "People mailed to the cap without a claim" })
    .getByRole("row")
    .filter({ hasText: STALE_STUDENT_NUMBER })
  await expect(staleRow).toBeVisible()
  await expect(staleRow.getByText(STALE_ADDRESS_EXACT)).toBeVisible()

  await staleRow.getByRole("button", { name: "Send the confirmation link again" }).click()
  const dialog = page.getByRole("dialog")

  await test.step("Without the override the cap refuses it", async () => {
    await dialog.getByRole("button", { name: "Confirm" }).click()
    await expect(dialog.getByText("A rate cap refused this.")).toBeVisible()
  })

  await test.step("With the override and a reason it goes out", async () => {
    await dialog.getByLabel("Send anyway, past the rate caps").check()
    await dialog
      .getByLabel("Reason")
      .fill("System test: proving the override retires the capped mails.")
    await dialog.getByRole("button", { name: "Confirm" }).click()
    await expect(dialog.getByText("A mail is owed")).toBeVisible()
    await expect(dialog.getByText("earlier mails were retired")).toBeVisible()
  })
})

test("A global-admin action recorded against a registration shows up on its detail page", async ({
  page,
}) => {
  const details = await adminRegistrationDetails(page.request, SUPERSEDED_ATTEMPT_1_ID)
  const seeded = details.actions.find((action) => action.action === "transition_item")
  expect(seeded).toMatchObject({
    actor_role: "global_admin",
    reason: "Seeded fixture: checked Sisu by hand and requeued",
    before_state: "submission_uncertain",
    after_state: "registered",
  })
})

test.fixme("A course-teacher's action, or one targeting something other than a registration, is visible somewhere", () => {
  // Course-, Phase- and student-number-verification-targeted actions — this file's own resend
  // override included — are written but have no reader anywhere: no route, no page.
})

test("A discovery run writes the per-realisation counters", async ({ page }) => {
  await runEnrolmentDiscoveryTick(page.request, { courseSlug: ADMIN_COURSE_SLUG })
  await runLinkEmailsTick(page.request, { courseSlug: ADMIN_COURSE_SLUG })

  const counters = await pollUntil(
    async () => {
      const stats = await accountLinkingStats(page.request)
      const mine = stats.realisations.find((row) => row.course_id === ADMIN_COURSE_ID)
      return mine?.last_listed_at ? mine : null
    },
    { description: "the admin course's realisation to report a listing" },
  )
  expect(counters.listed_person_count).toBeGreaterThan(0)
})
