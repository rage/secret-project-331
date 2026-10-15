import { expect, test } from "@playwright/test"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

const ORIGIN = "http://project-331.local"
const TEST_MODE_CODE_URL = `${ORIGIN}/api/v0/main-frontend/email-verification/test-mode-code?purpose=network_verification`
const VERIFIED_BROWSER_COOKIE = "verified_browser"

test("A role user on an unrecognized browser must enter the emailed code", async ({
  context,
  page,
}) => {
  const remainingCookies = (await context.cookies()).filter(
    (cookie) => cookie.name !== VERIFIED_BROWSER_COOKIE,
  )
  await context.clearCookies()
  await context.addCookies(remainingCookies)

  await page.goto(`${ORIGIN}/`)
  const dialog = page.getByTestId("session-verification-dialog")
  await expect(dialog).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(dialog).toBeVisible()

  // The code exists only once the dialog's email-code request has landed.
  await expect(dialog.getByText(/We sent a code to/)).toBeVisible()

  const codeResponse = await page.request.get(TEST_MODE_CODE_URL)
  await expect(codeResponse).toBeOK()
  const code: string = await codeResponse.json()
  expect(code).toMatch(/^[0-9]{6}$/)

  await dialog.getByRole("textbox").first().click()
  await page.keyboard.type(code)
  await dialog.getByRole("button", { name: "Verify" }).click()
  await expect(dialog).toBeHidden()

  const sessionStatus = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v0/auth/session-status",
  )
  await page.reload()
  expect(await (await sessionStatus).json()).toMatchObject({ verification_required: false })
  await expect(dialog).toBeHidden()
})
