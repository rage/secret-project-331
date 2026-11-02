import type { Page } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { MAIN_FRONTEND_API } from "@/utils/creditRegistration"
import {
  forgetMockMoocfiStudent,
  MOCK_MOOCFI_URL,
  MOOCFI_COURSE,
  MOOCFI_STUDENT_5,
  MOOCFI_TIERED_COURSE,
  moocfiRegistrationUrl,
  myMoocfiCreditRegistrations,
  openRegistrationFromMoocfi,
  seedMockMoocfiCompletions,
  setMockMoocfiCourseHasCertificate,
} from "@/utils/mockMoocfi"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"

/**
 * Owns `moocfi-student-5`, with one completion per course so each page shows one stepper. The
 * answers are stored on courses, which a reseed clears. Turns the tiered course's certificate off
 * in its last test; no other spec drives the questions on it.
 */
const STUDENT = MOOCFI_STUDENT_5
const COMPLETION_ID = "c5ed17ea-5a01-4a5e-9e6e-c0de00005a01"
const TIERED_COMPLETION_ID = "c5ed17ea-5a02-4a5e-9e6e-c0de00005a02"

const HANDOFF_PATH = "/moocfi-handoff"
const REASON = "My employer needs the credits in the registry."
const MOCK_REDEEM_URL = `${MOCK_MOOCFI_URL}/api/courses-handoff/redeem`

test.beforeEach(async ({ request }) => {
  await forgetMockMoocfiStudent(request, STUDENT)
  await setMockMoocfiCourseHasCertificate(request, MOOCFI_COURSE, true)
  await seedMockMoocfiCompletions(request, [
    {
      id: COMPLETION_ID,
      course_id: MOOCFI_COURSE.id,
      user_upstream_id: STUDENT.upstreamId,
      eligible_for_ects: true,
    },
    {
      id: TIERED_COMPLETION_ID,
      course_id: MOOCFI_TIERED_COURSE.id,
      user_upstream_id: STUDENT.upstreamId,
      eligible_for_ects: true,
      tier: 2,
    },
  ])
})

test.afterEach(async ({ request }) => {
  await setMockMoocfiCourseHasCertificate(request, MOOCFI_TIERED_COURSE, true)
})

/** Answers the questions up to "Which do you need?", the first one a certificate changes. */
const answerUpToWhichIsNeeded = async (page: Page) => {
  await page.getByRole("button", { name: "Start" }).click()
  await page
    .getByRole("radiogroup", { name: /student or an exchange student/ })
    .getByRole("radio", { name: "No" })
    .click()
  await page
    .getByRole("radiogroup", { name: /Finnish personal identity code/ })
    .getByRole("radio", { name: "No" })
    .click()
}

test("The certificate is on mooc.fi, and a reason for needing the credits is kept", async ({
  page,
  playwright,
}) => {
  await openRegistrationFromMoocfi(page, MOOCFI_COURSE, STUDENT)
  await answerUpToWhichIsNeeded(page)
  await page
    .getByRole("radiogroup", { name: "Which do you need?" })
    .getByRole("radio", { name: "A certificate of completion" })
    .click()

  const handoffResponse = page.waitForResponse((response) => response.url().endsWith(HANDOFF_PATH))
  await page.getByRole("button", { name: "Go to the certificate" }).click()
  const { redirect_url } = (await (await handoffResponse).json()) as { redirect_url: string }
  const token = new URL(redirect_url).hash.replace("#token=", "")

  await test.step("mooc.fi's landing redeems the token for this student and course", async () => {
    await page.waitForURL(/\/api\/v0\/mock-moocfi\/(en\/)?credit-registration-handoff\//)
    await expect(page.getByRole("heading", { name: "Mock mooc.fi certificate" })).toBeVisible()
    await expect(
      page.getByText(
        `Signed in as TMC user ${STUDENT.upstreamId}, going to /register-completion/${MOOCFI_COURSE.slug}/certificate`,
      ),
    ).toBeVisible()
    expect(page.url()).not.toContain("token=")
  })

  await test.step("The same token is refused the second time, and a made-up one outright", async () => {
    expect((await page.request.post(MOCK_REDEEM_URL, { data: { token } })).status()).toBe(410)
    expect(
      (await page.request.post(MOCK_REDEEM_URL, { data: { token: "not-a-handoff" } })).status(),
    ).toBe(400)
  })

  await test.step("Coming back shows the choice, with the way to the certificate again", async () => {
    await page.getByRole("link", { name: "Back to courses.mooc.fi" }).click()
    await page.waitForURL(`${moocfiRegistrationUrl(MOOCFI_COURSE)}**`)
    await expect(page.getByRole("heading", { name: "You chose the certificate" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Go to the certificate" })).toBeVisible()
    await accessibilityCheck(page, "mooc.fi completion with the certificate chosen")
  })

  await test.step("Changing to the credits keeps the reason the student gives", async () => {
    await page.getByRole("button", { name: "Change your choice" }).click()
    await page
      .getByRole("radiogroup", { name: "Which do you need?" })
      .getByRole("radio", { name: "University of Helsinki credits" })
      .click()
    await page
      .getByRole("radiogroup", { name: /Suomi.fi e-identification/ })
      .getByRole("radio", { name: "No", exact: true })
      .click()
    await page
      .getByRole("radiogroup", { name: "Reconsider: which do you need?" })
      .getByRole("radio", { name: "University of Helsinki credits" })
      .click()
    await page.getByLabel("Your reason").fill(REASON)
    await page.getByRole("button", { name: "Save reason" }).click()
    await expect(page.getByText("Your answer has been saved.")).toBeVisible()
  })

  const completion = (
    await myMoocfiCreditRegistrations(page.request, MOOCFI_COURSE)
  ).completions.find((row) => row.moocfi_completion_id === COMPLETION_ID)
  expect(completion?.credit_justification).toBe(REASON)
  const externalCompletionId = completion?.external_completion_id ?? ""
  expect(externalCompletionId).not.toBe("")

  await test.step("Another account gets a not-found for the completion", async () => {
    const other = await playwright.request.newContext({
      storageState: "src/states/user@example.com.json",
    })
    const completionApi = `${MAIN_FRONTEND_API}/credit-registrations/my/by-external-completion/${externalCompletionId}`
    expect(
      (
        await other.put(`${completionApi}/credit-justification`, {
          data: { justification: "Not mine." },
        })
      ).status(),
    ).toBe(404)
    expect(
      (
        await other.post(`${completionApi}${HANDOFF_PATH}`, {
          data: { destination: "certificate", ui_language: "en" },
        })
      ).status(),
    ).toBe(404)
    await other.dispose()
  })
})

test("Without a certificate on mooc.fi, the questions never offer one", async ({
  page,
  request,
}) => {
  await setMockMoocfiCourseHasCertificate(request, MOOCFI_TIERED_COURSE, false)
  await openRegistrationFromMoocfi(page, MOOCFI_TIERED_COURSE, STUDENT)
  await page.getByRole("button", { name: "Start" }).click()
  await page
    .getByRole("radiogroup", { name: /student or an exchange student/ })
    .getByRole("radio", { name: "No" })
    .click()
  await expect(
    page.getByRole("radiogroup", { name: /Finnish personal identity code/ }),
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Continue for instructions" })).toBeVisible()
})
