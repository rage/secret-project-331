import type { Page } from "@playwright/test"
import { expect } from "@playwright/test"

import { waitForSuccessNotification } from "@/utils/notificationUtils"

export interface SignUpOptions {
  firstName: string
  lastName: string
  email: string
  password: string
  /** Country picked in the "Where do you live?" selector. Defaults to "Andorra". */
  country?: string
  /** Path to return to after signup, e.g. "/org/uh-mathstat/courses/accessibility-course". */
  returnTo?: string
}

/**
 * Creates a fresh account through the signup page and clears the standard post-signup gates: the
 * research-consent form and the "confirm your email address" notice. Lands the browser on `returnTo`.
 *
 * Use this to get a guaranteed-fresh user (no prior enrollment or acknowledgements) for a course.
 */
export async function signUp(
  page: Page,
  { firstName, lastName, email, password, country = "Andorra", returnTo }: SignUpOptions,
): Promise<void> {
  const returnToParam = returnTo ? `return_to=${encodeURIComponent(returnTo)}&` : ""
  await page.goto(`http://project-331.local/signup?${returnToParam}lang=en-US`)

  await page.getByRole("textbox", { name: "First name" }).fill(firstName)
  await page.getByRole("textbox", { name: "Last name" }).fill(lastName)
  await page.getByRole("button", { name: "Select an item Where do you" }).click()
  await page.getByLabel("Where do you live?").getByText(country).click()
  await page.getByRole("textbox", { name: "Email" }).fill(email)
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password)
  await page.getByRole("textbox", { name: "Confirm password" }).fill(password)

  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Create an account" }).click()
  })

  // The research-consent form is shown to every new user and blocks the page until answered.
  await expect(page.getByRole("heading", { name: "Regarding research done on" })).toBeVisible()
  await page.getByText("I do not want to participate").click()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Save" }).click()
  })

  // "Please confirm your email address" notice — dismiss it so the redirect to returnTo proceeds.
  await expect(page.getByRole("heading", { name: "Please confirm your email" })).toBeVisible()
  await page.getByRole("button", { name: "Done" }).click()
}
