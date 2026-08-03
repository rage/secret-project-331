import { expect, test } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import {
  COURSE_CREDIT_REGISTRATIONS_API,
  CREDIT_REGISTRATION_ADMIN_API,
  ORIGIN,
} from "@/utils/creditRegistration"

/**
 * Owns student numbers `9000008xx` and reads the `credit-registration-states` course, whose module is
 * paused so its rows hold still: a read model needs every state present at once, and the workers in
 * the test deployment would otherwise walk them onwards.
 *
 * `teacher@example.com` is a teacher on the fixture courses and on nothing else here, which is what
 * makes the authorization cases meaningful.
 */
test.use({ storageState: "src/states/teacher@example.com.json" })

const STATES_COURSE_ID = "c5ed17ea-0007-4a5e-9e6e-c0de00000007"
const ADMIN_COURSE_ID = "c5ed17ea-0006-4a5e-9e6e-c0de00000006"
const STATES_COMPLETIONS_URL = `${ORIGIN}/manage/courses/${STATES_COURSE_ID}/students/completions`

/** The first two frozen fixtures hold a student number, one by email and one established by hand. */
const EMAIL_LINK_STUDENT_NUMBER = "900000801"
const ADMIN_MANUAL_STUDENT_NUMBER = "900000802"

test("A teacher sees the registration state and the verified student number in full", async ({
  page,
}) => {
  await page.goto(STATES_COMPLETIONS_URL)
  await expect(page.getByRole("heading", { name: "Credit registration" }).first()).toBeVisible()
  await expect(page.getByRole("columnheader", { name: "Student" })).toBeVisible()
  await accessibilityCheck(page, "Teacher credit registration summary", [])

  const response = await page.request.get(
    `${COURSE_CREDIT_REGISTRATIONS_API}/courses/${STATES_COURSE_ID}/list?limit=100`,
  )
  expect(response.ok()).toBe(true)
  const listed = (await response.json()) as {
    data: {
      state: string
      student_number: string | null
      student_number_verified_via: string | null
      error_code: string | null
    }[]
  }

  // One row per registration state and one per error code, so a teacher's status column has every
  // shape to render without waiting for some other spec to produce it.
  expect(new Set(listed.data.map((row) => row.state)).size).toBeGreaterThan(5)
  expect(
    listed.data.find((row) => row.student_number === EMAIL_LINK_STUDENT_NUMBER)
      ?.student_number_verified_via,
  ).toBe("emailed_link")
  // Support established this one by hand, which is what the teacher needs to know when it goes wrong.
  expect(
    listed.data.find((row) => row.student_number === ADMIN_MANUAL_STUDENT_NUMBER)
      ?.student_number_verified_via,
  ).toBe("admin_manual")
})

test("Teacher resend is refused by the rate cap and cannot be overridden", async ({ page }) => {
  const resend = async () =>
    await page.request.post(
      `${COURSE_CREDIT_REGISTRATIONS_API}/courses/${ADMIN_COURSE_ID}/resend-linking-email`,
      {
        data: {
          // Its own capped person, so this refusal cannot turn into a success because the admin
          // dashboard spec happened to override the cap for a different one first.
          student_number: "900000804",
          // Accepted by the schema and ignored: there is no teacher-side override at all, so a
          // teacher who guesses the admin payload gets the same refusal as one who does not.
          override_rate_caps: true,
          reason: "System test: a teacher may not pass the cap.",
        },
      },
    )

  const first = await resend()
  expect(first.ok()).toBe(true)
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
  const own = await page.request.get(
    `${COURSE_CREDIT_REGISTRATIONS_API}/courses/${STATES_COURSE_ID}/list?limit=1`,
  )
  expect(own.ok()).toBe(true)
  const listed = (await own.json()) as { data: { id: string; state: string }[] }
  const registrationId = listed.data[0]?.id
  const stateBefore = listed.data[0]?.state
  expect(registrationId).toBeDefined()

  await test.step("Authorization follows the row, not the course id in the path", async () => {
    // Done at the API level deliberately: the UI never offers the link, so clicking around proves
    // nothing about the check. A teacher elsewhere in the system is refused a row on a course they do
    // not teach, whatever they name in the path.
    const context = await browser.newContext({
      storageState: "src/states/language.teacher@example.com.json",
    })
    try {
      const foreign = await context.request.get(
        `${COURSE_CREDIT_REGISTRATIONS_API}/registrations/${registrationId}`,
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
    const asAdmin = await page.request.get(
      `${CREDIT_REGISTRATION_ADMIN_API}/registrations/${registrationId}`,
    )
    expect(asAdmin.status()).toBe(403)

    const transition = await page.request.post(
      `${CREDIT_REGISTRATION_ADMIN_API}/registrations/${registrationId}/transition`,
      { data: { to_state: "cancelled", reason: "System test: a teacher is not an admin." } },
    )
    expect(transition.status()).toBe(403)

    const after = await page.request.get(
      `${COURSE_CREDIT_REGISTRATIONS_API}/courses/${STATES_COURSE_ID}/list?limit=1`,
    )
    expect(after.ok()).toBe(true)
    const reread = (await after.json()) as { data: { id: string; state: string }[] }
    expect(reread.data[0]?.id).toBe(registrationId)
    expect(reread.data[0]?.state).toBe(stateBefore)
  })
})

test.fixme("A teacher retries a failed registration and sees it in the action history", () => {
  // Waiting on PR 3's teacher retry endpoint and per-course action history; no retry route exists on
  // the teacher surface yet.
})
