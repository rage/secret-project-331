import { expect, test } from "@playwright/test"

import { resetClientAuthorization } from "../../../utils/oauth/authorizedClients"
import { assertAndExtractCodeFromCallbackUrl } from "../../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../../utils/oauth/consentPage"
import {
  APP_DISPLAY_NAME,
  AUTHORIZE,
  REDIRECT_URI,
  STUDENT_STORAGE_STATE,
  TEST_CLIENT_ID,
} from "../../../utils/oauth/constants"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

test.describe("/authorize endpoint - Boundary Conditions", () => {
  test("very long state parameter -> should work", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STUDENT_STORAGE_STATE })
    const page = await ctx.newPage()

    try {
      await resetClientAuthorization(page)
      const longState = "a".repeat(1000)
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = generateCodeChallenge(codeVerifier)
      const { url } = await oauthUrl(["openid"], {
        codeChallenge,
        codeChallengeMethod: "S256",
      })
      // Replace state with long state
      const urlWithLongState = url.replace(/state=[^&]+/, `state=${longState}`)
      await page.goto(urlWithLongState)
      const consent = new ConsentPage(page, ["openid"])
      await consent.approve()
      const code = await assertAndExtractCodeFromCallbackUrl(page, longState)
      expect(code).toBeTruthy()
    } finally {
      await ctx.close()
    }
  })

  test("state with special characters -> should be preserved", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: STUDENT_STORAGE_STATE })
    const page = await ctx.newPage()

    try {
      await resetClientAuthorization(page)
      const specialState = "state+with/special=chars&more"
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = generateCodeChallenge(codeVerifier)
      const { url } = await oauthUrl(["openid"], {
        codeChallenge,
        codeChallengeMethod: "S256",
      })
      // Replace state with special chars
      const urlWithSpecialState = url.replace(
        /state=[^&]+/,
        `state=${encodeURIComponent(specialState)}`,
      )
      await page.goto(urlWithSpecialState)
      const consent = new ConsentPage(page, ["openid"])
      await consent.approve()
      // Wait for callback to finish loading, then extract state
      await assertAndExtractCodeFromCallbackUrl(page, specialState)
      const callbackUrl = new URL(page.url())
      const callbackState = callbackUrl.searchParams.get("state")
      expect(callbackState).toBe(specialState)
    } finally {
      await ctx.close()
    }
  })

  test("multiple scopes with various whitespace -> should normalize correctly", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ storageState: STUDENT_STORAGE_STATE })
    const page = await ctx.newPage()

    try {
      await resetClientAuthorization(page)
      // Use scope with extra whitespace
      const params = new URLSearchParams({
        response_type: "code",
        client_id: TEST_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: "openid   profile\n\temail", // Extra whitespace
        state: "test-state",
      })
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = generateCodeChallenge(codeVerifier)
      params.set("code_challenge", codeChallenge)
      params.set("code_challenge_method", "S256")
      const authUrl = `${AUTHORIZE}?${params.toString()}`

      await page.goto(authUrl)
      // Should proceed to consent page
      await page.waitForURL(/\/oauth_authorize_scopes/, { timeout: 10000 })
      // All scopes should be visible on consent page
      const consent = new ConsentPage(page, ["openid", "profile", "email"])
      await consent.expectVisible(new RegExp(`${APP_DISPLAY_NAME}|${TEST_CLIENT_ID}`))
    } finally {
      await ctx.close()
    }
  })
})
