import type { APIResponse } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { MAIN_FRONTEND_API, ORIGIN } from "@/utils/creditRegistration"
import {
  forgetMockMoocfiStudent,
  mintMoocfiHandoff,
  mockMoocfiRegistrationPageUrl,
  MOOCFI_COURSE,
  MOOCFI_STUDENT_1,
  MOOCFI_TIERED_COURSE,
  MOOCFI_TARGET_NAME,
  moocfiRegistrationUrl,
  openRegistrationFromMoocfi,
} from "@/utils/mockMoocfi"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"

/**
 * Owns `moocfi-student-1`. The redeem is rate limited per student, so each test redeems as few
 * handoffs as it can.
 */
const STUDENT = MOOCFI_STUDENT_1

const HANDOFFS_API = `${MAIN_FRONTEND_API}/moocfi-handoffs`
const REDEEM_PATH = "/api/v0/main-frontend/moocfi-handoffs/redeem"

const LOGIN_RETURN_PREFIX = "/login?return_to="

const expectSentToLogin = (response: APIResponse) => {
  expect(response.status()).toBe(303)
  const location = response.headers()["location"] ?? ""
  expect(location.startsWith(LOGIN_RETURN_PREFIX), location).toBe(true)
  expect(decodeURIComponent(location.slice(LOGIN_RETURN_PREFIX.length))).toBe(
    `/completion-registration/mooc-fi/${MOOCFI_COURSE.id}`,
  )
}

test.beforeEach(async ({ request }) => {
  await forgetMockMoocfiStudent(request, STUDENT)
})

test("The mooc.fi button signs the student in on the course's registration page", async ({
  page,
  playwright,
}) => {
  const redeemRequest = page.waitForRequest((request) => request.url().includes(REDEEM_PATH))
  await openRegistrationFromMoocfi(page, MOOCFI_COURSE, STUDENT)
  const redeemUrl = (await redeemRequest).url()

  await expect(page.getByRole("link", { name: "Back to mooc.fi" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "No completion found" })).toBeVisible()
  await expect(page.getByText(MOOCFI_TARGET_NAME)).toBeVisible()
  await accessibilityCheck(page, "mooc.fi registration page after a handoff")

  await test.step("A replay of the same handoff goes to the login page: it is single use", async () => {
    const replayer = await playwright.request.newContext()
    const replay = await replayer.get(redeemUrl, {
      headers: {
        "Sec-Fetch-Site": "same-site",
        Referer: mockMoocfiRegistrationPageUrl(MOOCFI_COURSE, STUDENT),
      },
      maxRedirects: 0,
    })
    expectSentToLogin(replay)
    await replayer.dispose()
  })
})

test("A same-site redeem that did not come from mooc.fi's page waits for the student to confirm", async ({
  playwright,
}) => {
  const visitor = await playwright.request.newContext()
  const redeemUrl = await mintMoocfiHandoff(visitor, MOOCFI_COURSE, STUDENT)
  const redeem = await visitor.get(redeemUrl, {
    headers: { "Sec-Fetch-Site": "same-site", Referer: `${ORIGIN}/somewhere-else` },
    maxRedirects: 0,
  })
  expect(redeem.status()).toBe(303)
  expect(redeem.headers()["location"]).toBe(
    `/completion-registration/mooc-fi/${MOOCFI_COURSE.id}/handoff?reason=confirm`,
  )
  await visitor.dispose()
})

test("A cross-site redeem signs nobody in, and waits for the student to confirm", async ({
  playwright,
}) => {
  // Not the browser: it sets `Sec-Fetch-Site` itself and no page can forge it, which is the point.
  const visitor = await playwright.request.newContext()
  const redeemUrl = await mintMoocfiHandoff(visitor, MOOCFI_COURSE, STUDENT)

  const redeem = await visitor.get(redeemUrl, {
    headers: { "Sec-Fetch-Site": "cross-site" },
    maxRedirects: 0,
  })
  expect(redeem.status()).toBe(303)
  expect(redeem.headers()["location"]).toBe(
    `/completion-registration/mooc-fi/${MOOCFI_COURSE.id}/handoff?reason=confirm`,
  )

  const registrations = await visitor.get(
    `${MAIN_FRONTEND_API}/moocfi-credit-registrations/${MOOCFI_COURSE.id}`,
  )
  expect(registrations.status()).toBe(401)

  const pendingFor = (moocfiCourseId: string) =>
    visitor.get(`${HANDOFFS_API}/pending?moocfi_course_id=${moocfiCourseId}`)

  await test.step("Only the handoff's own course's landing page sees it waiting", async () => {
    const pending = await pendingFor(MOOCFI_COURSE.id)
    expect(pending.status()).toBe(200)
    expect(((await pending.json()) as { signed_in_account: string }).signed_in_account).toBe("none")
    expect((await pendingFor(MOOCFI_TIERED_COURSE.id)).status()).toBe(404)
  })

  await test.step("Another site cannot complete it: the continuation needs a same-origin request", async () => {
    const forged = await visitor.post(`${HANDOFFS_API}/continue`, {
      headers: { "Sec-Fetch-Site": "cross-site" },
      data: { moocfi_course_id: MOOCFI_COURSE.id, expected_signed_in_account: "none" },
    })
    expect(forged.status()).toBe(403)
  })

  await test.step("Signing in or out elsewhere ends it", async () => {
    expect((await visitor.post(`${ORIGIN}/api/v0/auth/logout`)).ok()).toBe(true)
    expect((await pendingFor(MOOCFI_COURSE.id)).status()).toBe(404)
  })

  await visitor.dispose()
})

test("Arriving from another site, the student confirms the account and continues", async ({
  page,
  request,
}) => {
  const redeemUrl = await mintMoocfiHandoff(request, MOOCFI_COURSE, STUDENT)
  // Typed into the address bar, so `Sec-Fetch-Site` is `none`: not a same-site navigation, as from
  // Elements of AI.
  await page.goto(redeemUrl)
  await page.waitForURL(`${moocfiRegistrationUrl(MOOCFI_COURSE)}/handoff?reason=confirm`)
  await expect(
    page.getByRole("heading", { name: "Continue to your credit registration" }),
  ).toBeVisible()
  await expect(
    page.getByText(
      `This link signs you in as ${STUDENT.email}. Continue only if you just pressed the button on mooc.fi or Elements of AI.`,
    ),
  ).toBeVisible()
  await accessibilityCheck(page, "mooc.fi handoff confirmation after a cross-site arrival")

  await page.getByRole("button", { name: `Continue as ${STUDENT.email}` }).click()
  await page.waitForURL(moocfiRegistrationUrl(MOOCFI_COURSE))
  await expect(page.getByText(`Signed in as ${STUDENT.email}`)).toBeVisible()
})

test.describe("Another account already signed in", () => {
  test.use({ storageState: "src/states/user@example.com.json" })

  test("is explained, and the student continues with the mooc.fi account", async ({ page }) => {
    await page.goto(mockMoocfiRegistrationPageUrl(MOOCFI_COURSE, STUDENT))
    await page.getByRole("button", { name: "Register in courses.mooc.fi" }).click()

    await page.waitForURL(
      `${moocfiRegistrationUrl(MOOCFI_COURSE)}/handoff?reason=different_account`,
    )
    await expect(
      page.getByRole("heading", { name: "You are signed in with another account" }),
    ).toBeVisible()
    await expect(
      page.getByText(
        `You are signed in as user@example.com. This link signs you in as ${STUDENT.email}.`,
        { exact: false },
      ),
    ).toBeVisible()
    await accessibilityCheck(page, "mooc.fi handoff with another account signed in")

    await page.getByRole("button", { name: "Log out and continue" }).click()
    await page.waitForURL(moocfiRegistrationUrl(MOOCFI_COURSE))
    await expect(page.getByText(`Signed in as ${STUDENT.email}`)).toBeVisible()
  })
})

test("A session signed in from mooc.fi confirms the account before account security changes", async ({
  page,
}) => {
  await openRegistrationFromMoocfi(page, MOOCFI_COURSE, STUDENT)

  await test.step("The server refuses the changes until then", async () => {
    const changePassword = await page.request.post(`${MAIN_FRONTEND_API}/users/change-password`, {
      data: { old_password: "irrelevant", new_password: "irrelevant-too" },
    })
    expect(changePassword.status()).toBe(403)
    const deletionCode = await page.request.post(`${ORIGIN}/api/v0/auth/send-email-code`, {
      data: { password: "irrelevant", language: "en" },
    })
    expect(deletionCode.status()).toBe(403)
    const emailChange = await page.request.post(
      `${MAIN_FRONTEND_API}/user-details/update-user-info`,
      {
        data: {
          email: "someone-else@example.com",
          first_name: "Moocfi",
          last_name: "Student",
          country: "FI",
          email_communication_consent: false,
        },
      },
    )
    expect(emailChange.status()).toBe(403)
  })

  await test.step("The account page asks for the password or an emailed code", async () => {
    await page.goto(`${ORIGIN}/user-settings/account`)
    const section = page.getByTestId("reauthentication-section")
    await expect(
      section.getByRole("heading", { name: "Confirm that this is your account" }),
    ).toBeVisible()
    await expect(page.getByTestId("change-password-button")).toBeDisabled()
    await accessibilityCheck(page, "Account settings in a session signed in from mooc.fi")

    await section.getByLabel("Password").fill("not-the-password")
    await section.getByRole("button", { name: "Confirm" }).click()
    await expect(section.getByText("The password is not correct.", { exact: false })).toBeVisible()

    await section.getByRole("button", { name: `Send a code to ${STUDENT.email}` }).click()
    await expect(
      section.getByText(`We sent a code to ${STUDENT.email}. Enter it here.`),
    ).toBeVisible()
  })
})
