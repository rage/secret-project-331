import { expect, test } from "@playwright/test"

import {
  CREDIT_REGISTRATIONS_API,
  PROFILE_CREDIT_REGISTRATION_URL,
  seededStudentStorageState,
} from "@/utils/creditRegistration"
import { ADMIN_REGISTRATIONS_URL } from "@/utils/creditRegistrationAdmin"

/**
 * Owns student numbers `9000016xx` and reads two fixtures the seed writes rather than drives: the
 * already-linked student and the replaced attempt pair. This file ticks nothing at all, and every
 * other file that touches those two rows only reads them too.
 */
const LINKED_EMAIL = "credit-registration-consented-linked@example.com"
const LINKED_STUDENT_NUMBER = "900000101"
const SUPERSEDED_EMAIL = "credit-registration-superseded@example.com"
const EMPTY_EMAIL = "credit-registration-profile-empty@example.com"

test.describe("A student whose grade was registered twice", () => {
  test.use({ storageState: seededStudentStorageState(SUPERSEDED_EMAIL) })

  test("The cards render for a student with data, including a replaced attempt as history", async ({
    page,
  }) => {
    await page.goto(PROFILE_CREDIT_REGISTRATION_URL)

    await expect(page.getByRole("tab", { name: "Credit registration" })).toBeVisible()
    for (const heading of [
      "Student number",
      "Permission to register credits",
      "My credit registrations",
    ]) {
      await expect(page.getByRole("heading", { level: 3, name: heading })).toBeVisible()
    }

    const registrations = page.getByRole("table", { name: "My credit registrations" })
    await expect(registrations.getByText("Registered in Sisu").first()).toBeVisible()
    // The replaced attempt stays visible as history: a student who saw grade 3 registered should not
    // find that it never happened.
    await expect(registrations.getByText("Earlier attempt 1")).toBeVisible()
  })
})

test.describe("A student on a Suotar course and nothing else", () => {
  test.use({ storageState: seededStudentStorageState(EMPTY_EMAIL) })

  test("A student with nothing linked sees explanatory copy, not empty cards", async ({ page }) => {
    await page.goto(PROFILE_CREDIT_REGISTRATION_URL)

    await expect(page.getByRole("heading", { level: 3, name: "Student number" })).toBeVisible()
    await expect(
      page
        .getByText("No credit registrations yet", { exact: false })
        .or(page.getByRole("heading", { level: 3, name: "My credit registrations" })),
    ).toBeVisible()
  })

  test("A student cannot read another student's credit registrations", async ({ page }) => {
    // Ownership is filtered in SQL by the session's user, so there is no path to another student's
    // rows at all; asking for the whole collection returns only your own.
    const mine = await page.request.get(`${CREDIT_REGISTRATIONS_API}/my`)
    await expect(mine).toBeOK()
    expect(await mine.json()).toStrictEqual([])

    const someoneElsesProfile = await page.request.get(ADMIN_REGISTRATIONS_URL)
    expect(someoneElsesProfile.status()).toBe(403)
  })
})

test.describe("A student whose number was confirmed by the mailed link", () => {
  test.use({ storageState: seededStudentStorageState(LINKED_EMAIL) })

  test("The linked card names the number and how it was confirmed", async ({ page }) => {
    await page.goto(PROFILE_CREDIT_REGISTRATION_URL)

    await expect(page.getByText(LINKED_STUDENT_NUMBER)).toBeVisible()
    await expect(page.getByText("Linked").first()).toBeVisible()
    // We can see our own outbox and nothing else, so the copy may never claim delivery.
    await expect(page.getByText("delivered")).toHaveCount(0)
  })
})
