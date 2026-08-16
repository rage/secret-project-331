import type { APIRequestContext } from "@playwright/test"
import { expect, test } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import {
  ADMIN_COURSE_ID,
  COURSE_CREDIT_REGISTRATIONS_API,
  getJson,
  ORIGIN,
  STATES_COURSE_ID,
} from "@/utils/creditRegistration"
import {
  adminRegistrationTransitionUrl,
  adminRegistrationUrl,
} from "@/utils/creditRegistrationAdmin"

/**
 * Owns student numbers `9000008xx` and reads the `credit-registration-states` course, whose module is
 * paused so its rows hold still: a read model needs every state present at once, and the workers in
 * the test deployment would otherwise walk them onwards.
 *
 * `teacher@example.com` teaches the fixture courses and nothing else here, which is what makes the
 * authorization cases meaningful.
 */
test.use({ storageState: "src/states/teacher@example.com.json" })

const STATES_COMPLETIONS_URL = `${ORIGIN}/manage/courses/${STATES_COURSE_ID}/students/completions`

const EMAIL_LINK_STUDENT_NUMBER = "900000801"
const ADMIN_MANUAL_STUDENT_NUMBER = "900000802"

/** The subset of the teacher's per-course row these tests read. */
interface TeacherRegistrationRow {
  id: string
  state: string
  student_number: string | null
  student_number_verified_via: string | null
  error_code: string | null
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

test.fixme("A teacher retries a failed registration and sees it in the action history", () => {
  // Waiting on PR 3's teacher retry endpoint and per-course action history; no retry route exists on
  // the teacher surface yet.
})
