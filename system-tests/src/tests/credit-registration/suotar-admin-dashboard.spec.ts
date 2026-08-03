import { expect, test } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import {
  ADMIN_COURSE_SLUG,
  CREDIT_REGISTRATION_ADMIN_API,
  ORIGIN,
} from "@/utils/creditRegistration"
import { runEnrolmentDiscoveryTick, runLinkEmailsTick } from "@/utils/suotarControl"
import { pollUntil } from "@/utils/waitingUtils"

/**
 * Owns student numbers `9000009xx` and the `credit-registration-admin` course, which is the only
 * course this file ticks: discovery and the linking mails can be scoped by course alone, so ticking
 * them anywhere else would sweep another spec's students.
 *
 * Aggregate tiles are global and run-order dependent, so nothing here asserts a dashboard total.
 * Everything is either a row this file's own fixtures produced or a shape the page must have.
 */
test.use({ storageState: "src/states/admin@example.com.json" })

const OVERVIEW_URL = `${ORIGIN}/manage/credit-registration/overview`
const REGISTRATIONS_URL = `${ORIGIN}/manage/credit-registration/registrations`
const LINKING_URL = `${ORIGIN}/manage/credit-registration/linking`
const ADMIN_COURSE_ID = "c5ed17ea-0006-4a5e-9e6e-c0de00000006"

/** The seeded attempt chain: a registered grade 3 replaced by a registered grade 4. */
const SUPERSEDED_ATTEMPT_1_ID = "c5ed17ea-0901-4a5e-9e6e-c0de00000901"
const SUPERSEDED_ATTEMPT_2_ID = "c5ed17ea-0902-4a5e-9e6e-c0de00000902"

/** Distinctive by design, so their absence from a stored body is a meaningful assertion. */
const SUPERSEDED_STUDENT_NUMBER = "900000901"
const SUPERSEDED_LAST_NAME = "Regraded"
const SUPERSEDED_SISU_EMAIL = "zzyzx.regraded@helsinki.example"

const STALE_STUDENT_NUMBER = "900000903"
const STALE_ADDRESS = "zzyzx.deadaddress@helsinki.example"

test("The three shipped tabs render, and the phases report heartbeats", async ({ page }) => {
  await page.goto(OVERVIEW_URL)
  await expect(page.getByRole("heading", { level: 1, name: "Credit registration" })).toBeVisible()
  for (const name of ["Overview", "Registrations", "Account linking"]) {
    await expect(page.getByRole("tab", { name })).toBeVisible()
  }
  await expect(page.getByRole("heading", { name: "Where registrations stand" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Pipeline phases" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Study registry" })).toBeVisible()
  await accessibilityCheck(page, "Credit registration admin overview", [])

  await test.step("Both worker programs are alive and stamping their phases", async () => {
    const response = await page.request.get(`${CREDIT_REGISTRATION_ADMIN_API}/overview`)
    expect(response.ok()).toBe(true)
    const overview = (await response.json()) as {
      phases: { phase: string; process_name: string; last_heartbeat_at: string | null }[]
    }
    expect(overview.phases).toHaveLength(12)
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
  await expect(page.getByRole("columnheader", { name: "State" })).toBeVisible()

  await page.getByRole("tab", { name: "Account linking" }).click()
  await expect(page.getByRole("heading", { name: "Account linking" }).first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "Per course realisation" })).toBeVisible()
})

test("The explorer filters, and the attempt chain hides the replaced attempt by default", async ({
  page,
}) => {
  await page.goto(`${REGISTRATIONS_URL}?student_number=${SUPERSEDED_STUDENT_NUMBER}`)
  const table = page.getByRole("table", { name: "Registrations" })
  await expect(table.getByRole("row")).toHaveCount(2)

  await page.getByLabel("Show replaced attempts").check()
  await expect(table.getByRole("row")).toHaveCount(3)

  await page.goto(`${ORIGIN}/manage/credit-registration/registrations/${SUPERSEDED_ATTEMPT_2_ID}`)
  await expect(page.getByRole("heading", { name: "Attempts for this completion" })).toBeVisible()
  await expect(
    page.getByText("A replaced attempt is shown for history only.", { exact: false }),
  ).toBeVisible()
  await accessibilityCheck(page, "Credit registration admin item detail", [])

  await test.step("A replaced attempt offers no actions", async () => {
    await page.goto(`${ORIGIN}/manage/credit-registration/registrations/${SUPERSEDED_ATTEMPT_1_ID}`)
    await expect(page.getByText("This attempt has been replaced by a later one.")).toBeVisible()
    await expect(page.getByRole("button", { name: "Move this registration" })).toHaveCount(0)
  })
})

test("No stored body carries a student number, a name or an email address", async ({ page }) => {
  const response = await page.request.get(
    `${CREDIT_REGISTRATION_ADMIN_API}/registrations/${SUPERSEDED_ATTEMPT_2_ID}`,
  )
  expect(response.ok()).toBe(true)
  const details = (await response.json()) as {
    events: { details: unknown }[]
    suotar_api_calls: { request_body_sample: unknown; response_body_sample: unknown }[]
  }

  const stored = JSON.stringify([
    details.events.map((event) => event.details),
    details.suotar_api_calls.map((call) => [call.request_body_sample, call.response_body_sample]),
  ])
  for (const secret of [SUPERSEDED_STUDENT_NUMBER, SUPERSEDED_LAST_NAME, SUPERSEDED_SISU_EMAIL]) {
    expect(stored, `a stored body carries ${secret}`).not.toContain(secret)
  }

  await test.step("The unredacted half is still there, so the panel is worth reading", async () => {
    // The scrubbing note is what tells an admin the gaps are deliberate; without it, an empty panel
    // and a redacted one look the same.
    await page.goto(`${ORIGIN}/manage/credit-registration/registrations/${SUPERSEDED_ATTEMPT_2_ID}`)
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
  await staleRow.getByRole("button", { name: "Send the confirmation link again" }).click()
  await page.getByRole("button", { name: "Student cannot receive our mail at all?" }).click()

  const dialog = page.getByRole("dialog").filter({ hasText: "Link a student number by hand" })
  const confirm = dialog.getByRole("button", { name: "Link this number by hand" })
  // Both gates matter: the preview is what proves the number belongs to the person on the phone, and
  // the reason is the only record of why support went around the mailed link.
  await expect(confirm).toBeDisabled()

  await test.step("The API refuses the same two ways", async () => {
    const withoutPreview = await page.request.post(
      `${CREDIT_REGISTRATION_ADMIN_API}/account-linking/manual-link`,
      {
        data: {
          user_id: "00000000-0000-0000-0000-000000000000",
          student_number: STALE_STUDENT_NUMBER,
          sisu_person_id: "",
          reason: "System test",
        },
      },
    )
    expect(withoutPreview.status()).toBe(422)

    const withoutReason = await page.request.post(
      `${CREDIT_REGISTRATION_ADMIN_API}/account-linking/manual-link`,
      {
        data: {
          user_id: "00000000-0000-0000-0000-000000000000",
          student_number: STALE_STUDENT_NUMBER,
          sisu_person_id: `hy-hlo-${STALE_STUDENT_NUMBER}`,
          reason: "   ",
        },
      },
    )
    expect(withoutReason.status()).toBe(422)
  })

  await test.step("A preview naming a different person is refused as a mismatch", async () => {
    const mismatched = await page.request.post(
      `${CREDIT_REGISTRATION_ADMIN_API}/account-linking/manual-link`,
      {
        data: {
          user_id: "00000000-0000-0000-0000-000000000000",
          student_number: STALE_STUDENT_NUMBER,
          sisu_person_id: "hy-hlo-somebody-else",
          reason: "System test: the preview named somebody else.",
        },
      },
    )
    expect(mismatched.ok()).toBe(true)
    expect(await mismatched.json()).toMatchObject({ outcome: "preview_mismatch" })
  })
})

test("Admin resend can pass the rate cap with a reason, and it is audited", async ({ page }) => {
  await page.goto(LINKING_URL)
  const staleRow = page
    .getByRole("table", { name: "People mailed to the cap without a claim" })
    .getByRole("row")
    .filter({ hasText: STALE_STUDENT_NUMBER })
  await expect(staleRow).toBeVisible()
  await expect(staleRow.getByText(STALE_ADDRESS)).toBeVisible()

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

test("A discovery run writes the per-realisation counters", async ({ page }) => {
  await runEnrolmentDiscoveryTick(page.request, { courseSlug: ADMIN_COURSE_SLUG })
  await runLinkEmailsTick(page.request, { courseSlug: ADMIN_COURSE_SLUG })

  const counters = await pollUntil(
    async () => {
      const response = await page.request.get(`${CREDIT_REGISTRATION_ADMIN_API}/account-linking`)
      if (!response.ok()) {
        return null
      }
      const stats = (await response.json()) as {
        realisations: {
          course_id: string
          last_listed_at: string | null
          listed_person_count: number | null
        }[]
      }
      const mine = stats.realisations.find((row) => row.course_id === ADMIN_COURSE_ID)
      return mine?.last_listed_at ? mine : null
    },
    { description: "the admin course's realisation to report a listing" },
  )
  expect(counters.listed_person_count).toBeGreaterThan(0)
})
