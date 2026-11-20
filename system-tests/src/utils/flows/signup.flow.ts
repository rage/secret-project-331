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

/** Selects a country in the "Where do you live?" combobox on the signup page. */
export async function selectSignupCountry(page: Page, country: string): Promise<void> {
  await page.getByRole("combobox", { name: "Where do you live?" }).click()
  await page.getByRole("option", { name: country, exact: true }).click()
}

/**
 * Creates a fresh account through the signup page and clears the standard post-signup gates: the
 * emailed confirmation code and the research-consent form. Lands the browser on `returnTo`.
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
  await selectSignupCountry(page, country)
  await page.getByRole("textbox", { name: "Email" }).fill(email)
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password)
  await page.getByRole("textbox", { name: "Confirm password" }).fill(password)

  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Create an account" }).click()
  })

  await confirmSignupWithMailedCode(page)

  // The research-consent form is shown to every new user and blocks the page until answered.
  await expect(page.getByRole("heading", { name: "Regarding research done on" })).toBeVisible()
  await page.getByRole("radio", { name: "I do not want to participate" }).check()
  await waitForSuccessNotification(page, async () => {
    await page.getByRole("button", { name: "Save" }).click()
  })
  await page.getByRole("button", { name: "Done" }).click()
}

/**
 * Types the code of the pending signup on the "Check your email" step. The code comes from a
 * test-mode endpoint, as the system tests have no mail capture.
 */
export async function confirmSignupWithMailedCode(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
  const response = await page.request.get(
    "http://project-331.local/api/v0/auth/create-account/test-mode-code",
  )
  await expect(response).toBeOK()
  const code: string = await response.json()
  await page.getByTestId("one-time-code-field").getByRole("textbox").first().click()
  await page.keyboard.type(code)
}
