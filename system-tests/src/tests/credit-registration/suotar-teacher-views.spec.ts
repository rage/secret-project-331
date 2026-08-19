import type { APIRequestContext } from "@playwright/test"
import { expect, test } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import {
  ADMIN_COURSE_ID,
  COURSE_CREDIT_REGISTRATIONS_API,
  getJson,
  ORIGIN,
  RETRY_COURSE_ID,
  STATES_COURSE_ID,
} from "@/utils/creditRegistration"
import {
  adminRegistrationTransitionUrl,
  adminRegistrationUrl,
} from "@/utils/creditRegistrationAdmin"

/**
 * Owns student numbers `9000008xx`. Reads the `credit-registration-states` course and writes to the
 * `credit-registration-retry` one; both have a paused module so their rows hold still — a read model
 * needs every state present at once, and the workers in the test deployment would otherwise walk
 * them onwards.
 *
 * The retry fixtures are a course of their own because a bulk retry sweeps a whole course: run
 * against the states course it would leave that fixture with no failure and no error codes.
 *
 * `teacher@example.com` teaches the fixture courses and nothing else here, which is what makes the
 * authorization cases meaningful.
 * Serial and order-dependent: the single-row retry test spends `Retry01`'s `failed_permanent` state,
 * and the bulk retry after it sweeps the whole retry course. `retries: 0` because neither state comes
 * back, so retrying only turns one failure into three.
 */
test.describe.configure({ mode: "serial", retries: 0 })

test.use({ storageState: "src/states/teacher@example.com.json" })

const STATES_COMPLETIONS_URL = `${ORIGIN}/manage/courses/${STATES_COURSE_ID}/students/completions`
const RETRY_COMPLETIONS_URL = `${ORIGIN}/manage/courses/${RETRY_COURSE_ID}/students/completions`

const EMAIL_LINK_STUDENT_NUMBER = "900000801"
const ADMIN_MANUAL_STUDENT_NUMBER = "900000802"

/** The retry fixtures, by the last name the seed gives each one. */
const RETRIABLE = "Retry01"
const BULK_RETRIABLE = "Retry02"
const SUBMISSION_UNCERTAIN = "Retry03"
const CONSENT_WITHDRAWN = "Retry04"

/** The subset of the teacher's per-course row these tests read. */
interface TeacherRegistrationRow {
  id: string
  state: string
  last_name: string | null
  student_number: string | null
  student_number_verified_via: string | null
  error_code: string | null
}

interface CourseAction {
  action: string
  actor_role: string
  target_id: string | null
  before_state: string | null
  after_state: string | null
  affected_row_count: number | null
}

const listForCourse = async (
  request: APIRequestContext,
  courseId: string,
  limit: number,
): Promise<TeacherRegistrationRow[]> => {
  const page = await getJson<{ data: TeacherRegistrationRow[] }>(
    request,
    `${COURSE_CREDIT_REGISTRATIONS_API}/courses/${courseId}/list?limit=${limit}`,
  )
  return page.data
}

/** Both lookups fail here rather than as an `undefined` in an assertion that then blames the API. */
const rowWithStudentNumber = (
  rows: TeacherRegistrationRow[],
  studentNumber: string,
): TeacherRegistrationRow => {
  const row = rows.find((candidate) => candidate.student_number === studentNumber)
  if (row === undefined) {
    throw new Error(
      `No row for ${studentNumber} among the ${rows.length} the course listed. Is the fixture still seeded?`,
    )
  }
  return row
}

const rowWithLastName = (
  rows: TeacherRegistrationRow[],
  lastName: string,
): TeacherRegistrationRow => {
  const row = rows.find((candidate) => candidate.last_name === lastName)
  if (row === undefined) {
    throw new Error(
      `No row for ${lastName} among the ${rows.length} the course listed. Is the retry fixture still seeded?`,
    )
  }
  return row
}

const retryFixture = async (
  request: APIRequestContext,
  lastName: string,
): Promise<TeacherRegistrationRow> =>
  rowWithLastName(await listForCourse(request, RETRY_COURSE_ID, 100), lastName)

const retry = (request: APIRequestContext, registrationId: string) =>
  request.post(`${COURSE_CREDIT_REGISTRATIONS_API}/registrations/${registrationId}/retry`, {
    data: {},
  })

const courseActions = (request: APIRequestContext, courseId: string): Promise<CourseAction[]> =>
  getJson<CourseAction[]>(request, `${COURSE_CREDIT_REGISTRATIONS_API}/courses/${courseId}/actions`)

const firstListedRow = (rows: TeacherRegistrationRow[]): TeacherRegistrationRow => {
  const [first] = rows
  if (first === undefined) {
    throw new Error(
      "The course listed no registrations at all. Is the states fixture still seeded?",
    )
  }
  return first
}

test("A teacher sees the registration state and the verified student number in full", async ({
  page,
}) => {
  await page.goto(STATES_COMPLETIONS_URL)
  await expect(page.getByRole("heading", { name: "Credit registration" }).first()).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Student" })).toBeVisible()
  await accessibilityCheck(page, "Teacher credit registration summary")

  const listed = await listForCourse(page.request, STATES_COURSE_ID, 100)

  // The fixture holds one row per registration state and one per error code, so the status column has
  // every shape to render without waiting for another spec to produce it.
  expect(new Set(listed.map((row) => row.state)).size).toBeGreaterThan(5)
  expect(rowWithStudentNumber(listed, EMAIL_LINK_STUDENT_NUMBER).student_number_verified_via).toBe(
    "emailed_link",
  )
  // Support established this one by hand, which is what the teacher needs to know when it goes wrong.
  expect(
    rowWithStudentNumber(listed, ADMIN_MANUAL_STUDENT_NUMBER).student_number_verified_via,
  ).toBe("admin_manual")
})

test("Teacher resend is refused by the rate cap and cannot be overridden", async ({ page }) => {
  const resend = async () =>
    await page.request.post(
      `${COURSE_CREDIT_REGISTRATIONS_API}/courses/${ADMIN_COURSE_ID}/resend-linking-email`,
      {
        data: {
          // Its own capped person, so the admin dashboard spec overriding the cap for a different one
          // cannot turn this refusal into a success.
          student_number: "900000804",
          // Accepted by the schema and ignored: there is no teacher-side override at all.
          override_rate_caps: true,
          reason: "System test: a teacher may not pass the cap.",
        },
      },
    )

  const first = await resend()
  await expect(first).toBeOK()
  expect(await first.json()).toMatchObject({ outcome: "refused_by_rate_cap" })

  await test.step("The teacher UI offers no override anywhere", async () => {
    await page.goto(STATES_COMPLETIONS_URL)
    await expect(page.getByLabel("Send anyway, past the rate caps")).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Student cannot receive our mail at all?" }),
    ).toHaveCount(0)
  })
})

test("A teacher of another course cannot read this course's registration", async ({
  browser,
  page,
}) => {
  const own = firstListedRow(await listForCourse(page.request, STATES_COURSE_ID, 1))

  await test.step("Authorization follows the row, not the course id in the path", async () => {
    // Done at the API level: the UI never offers the link, so clicking around proves
    // nothing about the check.
    const context = await browser.newContext({
      storageState: "src/states/language.teacher@example.com.json",
    })
    try {
      const foreign = await context.request.get(
        `${COURSE_CREDIT_REGISTRATIONS_API}/registrations/${own.id}`,
      )
      expect(foreign.status()).toBe(403)

      const foreignList = await context.request.get(
        `${COURSE_CREDIT_REGISTRATIONS_API}/courses/${STATES_COURSE_ID}/list?limit=1`,
      )
      expect(foreignList.status()).toBe(403)
    } finally {
      await context.close()
    }
  })

  await test.step("A teacher is not an admin either, and the row is unchanged", async () => {
    const asAdmin = await page.request.get(adminRegistrationUrl(own.id))
    expect(asAdmin.status()).toBe(403)

    const transition = await page.request.post(adminRegistrationTransitionUrl(own.id), {
      data: { to_state: "cancelled", reason: "System test: a teacher is not an admin." },
    })
    expect(transition.status()).toBe(403)

    const reread = firstListedRow(await listForCourse(page.request, STATES_COURSE_ID, 1))
    expect(reread.id).toBe(own.id)
    expect(reread.state).toBe(own.state)
  })
})

test("A teacher retries a failed registration, and the course says who did it", async ({
  page,
}) => {
  const failed = await retryFixture(page.request, RETRIABLE)
  expect(failed.state).toBe("failed_permanent")

  const response = await retry(page.request, failed.id)
  await expect(response).toBeOK()
  expect(await response.json()).toMatchObject({ outcome: "retried", state: "ready_to_submit" })

  // The module is paused, so nothing claims the row and the state the retry left it in is readable.
  expect((await retryFixture(page.request, RETRIABLE)).state).toBe("ready_to_submit")

  const actions = await courseActions(page.request, RETRY_COURSE_ID)
  const mine = actions.find(
    (action) => action.action === "retry_item" && action.target_id === failed.id,
  )
  expect(mine).toMatchObject({
    actor_role: "course_teacher",
    before_state: "failed_permanent",
    after_state: "ready_to_submit",
  })

  await test.step("The history is on the page, so a colleague sees it before clicking", async () => {
    await page.goto(RETRY_COMPLETIONS_URL)
    await expect(page.getByRole("heading", { name: "Recent actions on this course" })).toBeVisible()
    await expect(page.getByText("retried a registration").first()).toBeVisible()
    await accessibilityCheck(page, "Teacher credit registration action history")
  })
})

test("A teacher may not retry a row the study registry's answer left uncertain", async ({
  page,
}) => {
  const uncertain = await retryFixture(page.request, SUBMISSION_UNCERTAIN)
  expect(uncertain.state).toBe("submission_uncertain")

  // Re-importing this could put a second attainment on a real transcript, and we cannot see or undo
  // that, so the refusal is the whole point of the endpoint's existence.
  const refused = await retry(page.request, uncertain.id)
  await expect(refused).toBeOK()
  expect(await refused.json()).toMatchObject({
    outcome: "refused_submission_uncertain",
    state: "submission_uncertain",
  })
  expect((await retryFixture(page.request, SUBMISSION_UNCERTAIN)).state).toBe(
    "submission_uncertain",
  )

  await test.step("Nor one the student withdrew their consent from", async () => {
    const withdrawn = await retryFixture(page.request, CONSENT_WITHDRAWN)
    const response = await retry(page.request, withdrawn.id)
    await expect(response).toBeOK()
    expect(await response.json()).toMatchObject({
      outcome: "refused_consent_withdrawn",
      state: "abandoned_by_consent_withdrawal",
    })
  })
})

test("Bulk retry names its cap and the rows it left alone", async ({ page }) => {
  const bulkRetriable = await retryFixture(page.request, BULK_RETRIABLE)
  expect(bulkRetriable.state).toBe("failed_permanent")

  const response = await page.request.post(
    `${COURSE_CREDIT_REGISTRATIONS_API}/courses/${RETRY_COURSE_ID}/retry-failed`,
    { data: {} },
  )
  await expect(response).toBeOK()
  const result = await response.json()
  expect(result).toMatchObject({ max_rows_per_call: 500, more_rows_remaining: false })
  // Only this test's own row is guaranteed: the single-row test may already have taken the other
  // one out of `failed_permanent`.
  expect(result.retried_count).toBeGreaterThanOrEqual(1)
  expect(result.skipped).toContainEqual({ outcome: "refused_submission_uncertain", count: 1 })

  expect((await retryFixture(page.request, BULK_RETRIABLE)).state).toBe("ready_to_submit")
  expect((await retryFixture(page.request, SUBMISSION_UNCERTAIN)).state).toBe(
    "submission_uncertain",
  )

  const bulk = (await courseActions(page.request, RETRY_COURSE_ID)).find(
    (action) => action.action === "retry_failed_for_course",
  )
  expect(bulk).toMatchObject({ actor_role: "course_teacher" })
})

test("A teacher cannot retry a registration on a course they do not teach", async ({
  browser,
  page,
}) => {
  // The withdrawn row: no retry of any shape moves it, so its state before and after is this test's
  // alone whatever order the file runs in.
  const victim = await retryFixture(page.request, CONSENT_WITHDRAWN)

  const context = await browser.newContext({
    storageState: "src/states/language.teacher@example.com.json",
  })
  try {
    // At the API level deliberately: the UI never offers the button, so clicking around proves
    // nothing about the check.
    const single = await context.request.post(
      `${COURSE_CREDIT_REGISTRATIONS_API}/registrations/${victim.id}/retry`,
      { data: {} },
    )
    expect(single.status()).toBe(403)

    const bulk = await context.request.post(
      `${COURSE_CREDIT_REGISTRATIONS_API}/courses/${RETRY_COURSE_ID}/retry-failed`,
      { data: {} },
    )
    expect(bulk.status()).toBe(403)

    const history = await context.request.get(
      `${COURSE_CREDIT_REGISTRATIONS_API}/courses/${RETRY_COURSE_ID}/actions`,
    )
    expect(history.status()).toBe(403)
  } finally {
    await context.close()
  }

  expect((await retryFixture(page.request, CONSENT_WITHDRAWN)).state).toBe(victim.state)
})

test("The export carries verified student numbers in full", async ({ page }) => {
  await page.goto(STATES_COMPLETIONS_URL)
  await expect(
    page.getByRole("button", { name: "Export credit registrations as CSV" }),
  ).toBeVisible()

  const response = await page.request.get(
    `${COURSE_CREDIT_REGISTRATIONS_API}/courses/${STATES_COURSE_ID}/export`,
  )
  await expect(response).toBeOK()
  const csv = await response.text()
  expect(csv.split("\n")[0]).toContain("student_number")
  // In full, because the teacher is holding it against a student card.
  expect(csv).toContain(EMAIL_LINK_STUDENT_NUMBER)
  // Every seeded Sisu address begins `zzyzx.`, so an unmasked one would show up here.
  expect(csv).not.toContain("zzyzx.")
})
