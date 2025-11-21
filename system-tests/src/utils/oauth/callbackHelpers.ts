import { expect, Page } from "@playwright/test"

import { REDIRECT_URI } from "./constants"

/** Assert the browser landed on the callback and the final URL has code & expected state.
 *  Returns the authorization code for token exchange. */
export async function assertAndExtractCodeFromCallbackUrl(
  page: Page,
  expectedState: string,
): Promise<string> {
  const expected = new URL(REDIRECT_URI)

  // Wait for the callback page element instead of URL pattern
  await page.getByText("Callback OK").waitFor({ timeout: 10000 })

  await page.waitForLoadState("domcontentloaded")
  const final = new URL(page.url())
  expect(final.origin + final.pathname).toBe(expected.origin + expected.pathname)

  const code = final.searchParams.get("code")
  const state = final.searchParams.get("state")
  expect(state).toBe(expectedState)
  expect(code).toBeTruthy()
  return code!
}
