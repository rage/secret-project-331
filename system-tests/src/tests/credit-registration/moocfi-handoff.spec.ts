import type { APIResponse } from "@playwright/test"

import accessibilityCheck from "@/utils/accessibilityCheck"
import { MAIN_FRONTEND_API } from "@/utils/creditRegistration"
import {
  forgetMockMoocfiStudent,
  mintMoocfiHandoff,
  mockMoocfiRegistrationPageUrl,
  MOOCFI_COURSE,
  MOOCFI_STUDENT_1,
  MOOCFI_TARGET_NAME,
  moocfiRegistrationUrl,
  openRegistrationFromMoocfi,
} from "@/utils/mockMoocfi"
import { expect, testThatCanFail as test } from "@/utils/nonBlockingTest"

/**
 * Owns `moocfi-student-1`. The redeem is rate limited per IP, which every spec shares, so
 * each test redeems as few handoffs as it can.
 */
const STUDENT = MOOCFI_STUDENT_1

/** A handoff lives 10 s with no leeway. */
const HANDOFF_LIFETIME_MS = 10_000
const EXPIRY_MARGIN_MS = 2_000

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
  const mintedAt = Date.now()

  await expect(page.getByRole("link", { name: "Back to mooc.fi" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "No completion found" })).toBeVisible()
  await expect(page.getByText(MOOCFI_TARGET_NAME)).toBeVisible()
  await accessibilityCheck(page, "mooc.fi registration page after a handoff")

  await test.step("A replay of the same handoff after it expired goes to the login page", async () => {
    await new Promise((resolve) => {
      setTimeout(
        resolve,
        Math.max(0, mintedAt + HANDOFF_LIFETIME_MS + EXPIRY_MARGIN_MS - Date.now()),
      )
    })
    const replayer = await playwright.request.newContext()
    const replay = await replayer.get(redeemUrl, {
      headers: { "Sec-Fetch-Site": "same-site" },
      maxRedirects: 0,
    })
    expectSentToLogin(replay)
    await replayer.dispose()
  })
})

test("A redeem that is not a same-site navigation goes to the login page and signs nobody in", async ({
  playwright,
}) => {
  // Not the browser: it sets `Sec-Fetch-Site` itself and no page can forge it, which is the point.
  const visitor = await playwright.request.newContext()
  const redeemUrl = await mintMoocfiHandoff(visitor, MOOCFI_COURSE, STUDENT)

  expectSentToLogin(
    await visitor.get(redeemUrl, {
      headers: { "Sec-Fetch-Site": "cross-site" },
      maxRedirects: 0,
    }),
  )
  expectSentToLogin(await visitor.get(redeemUrl, { maxRedirects: 0 }))

  const registrations = await visitor.get(
    `${MAIN_FRONTEND_API}/moocfi-credit-registrations/${MOOCFI_COURSE.id}`,
  )
  expect(registrations.status()).toBe(401)
  await visitor.dispose()
})

test.describe("Another account already signed in", () => {
  test.use({ storageState: "src/states/user@example.com.json" })

  test("is never switched: the student signs out and presses the button again", async ({
    page,
  }) => {
    await page.goto(mockMoocfiRegistrationPageUrl(MOOCFI_COURSE, STUDENT))
    await page.getByRole("button", { name: "Register in courses.mooc.fi" }).click()

    await page.waitForURL(
      `${moocfiRegistrationUrl(MOOCFI_COURSE)}/handoff-error?reason=different_user_signed_in`,
    )
    await expect(page.getByRole("heading", { name: "Another account is signed in" })).toBeVisible()
    await expect(page.getByText("Signed in as user@example.com")).toBeVisible()
    await accessibilityCheck(page, "mooc.fi handoff with another account signed in")

    await page.getByRole("button", { name: "Log out" }).click()
    await expect(
      page.getByText(
        "You are signed out. Go back to mooc.fi and press the registration button again.",
      ),
    ).toBeVisible()

    // The mock page remembers the TMC token the way mooc.fi's login cookie does.
    await page.getByRole("link", { name: "Back to mooc.fi" }).click()
    await page.getByRole("button", { name: "Register in courses.mooc.fi" }).click()
    await page.waitForURL(moocfiRegistrationUrl(MOOCFI_COURSE))
    await expect(page.getByText(`Signed in as ${STUDENT.email}`)).toBeVisible()
  })
})
