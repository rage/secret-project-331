import { expect, Page } from "@playwright/test"

import { REDIRECT_URI } from "./constants"

export interface OAuthError {
  error: string
  error_description?: string
  state?: string
}

/**
 * Extract OAuth error parameters from a redirect URL.
 * Waits for the page to navigate to the redirect_uri with error parameters.
 */
export async function extractOAuthErrorFromRedirect(
  page: Page,
  expectedState?: string,
): Promise<OAuthError> {
  const redirectBase = new URL(REDIRECT_URI)

  // Wait for navigation to redirect URI
  await page.waitForURL(
    (url) => {
      const u = new URL(url)
      return u.origin + u.pathname === redirectBase.origin + redirectBase.pathname
    },
    { timeout: 10000 },
  )

  const finalUrl = new URL(page.url())
  const error = finalUrl.searchParams.get("error")
  const error_description = finalUrl.searchParams.get("error_description")
  const state = finalUrl.searchParams.get("state")

  expect(error).toBeTruthy()

  const result: OAuthError = { error: error! }
  if (error_description) {
    result.error_description = error_description
  }
  if (state) {
    result.state = state
  }
  if (expectedState) {
    expect(state).toBe(expectedState)
  }

  return result
}

/**
 * Navigate to an authorize URL and wait for an OAuth error redirect.
 */
export async function navigateAndWaitForOAuthError(
  page: Page,
  url: string,
  expectedState?: string,
): Promise<OAuthError> {
  await page.goto(url)
  return await extractOAuthErrorFromRedirect(page, expectedState)
}
