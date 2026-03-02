import { expect, Page, test } from "@playwright/test"

import { assertAndExtractCodeFromCallbackUrl } from "../../../utils/oauth/callbackHelpers"
import { ConsentPage } from "../../../utils/oauth/consentPage"
import {
  getOAuthTestUser,
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
  TOKEN,
} from "../../../utils/oauth/constants"
import { performLogin } from "../../../utils/oauth/loginHelpers"
import { generateCodeChallenge, generateCodeVerifier } from "../../../utils/oauth/pkce"
import { getRedirectUri } from "../../../utils/oauth/redirectServer"
import { setupRedirectServer, teardownRedirectServer } from "../../../utils/oauth/redirectServer"
import { exchangeCodeForToken } from "../../../utils/oauth/tokenHelpers"
import { oauthUrl } from "../../../utils/oauth/urlHelpers"

test.beforeAll(async () => {
  await setupRedirectServer()
})
test.afterAll(async () => {
  await teardownRedirectServer()
})

const CLIENT_AUTH_USER = getOAuthTestUser("client-auth")

test.describe("/token endpoint - Client Authentication", () => {
  async function getValidAuthCode(page: Page): Promise<{ code: string; codeVerifier: string }> {
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const { url, state } = await oauthUrl(["openid"], {
      codeChallenge,
      codeChallengeMethod: "S256",
    })
    await page.goto(url)

    try {
      await page.waitForURL(/\/login\?return_to=.*/, { timeout: 2000 })
      await performLogin(page, CLIENT_AUTH_USER.email, CLIENT_AUTH_USER.password)
    } catch {
      // Already logged in or consent already granted
    }

    try {
      await page.waitForURL(/\/oauth_authorize_scopes/, { timeout: 2000 })
      const consent = new ConsentPage(page, ["openid"])
      await consent.approve()
    } catch {
      // Already logged in or consent already granted
    }

    const code = await assertAndExtractCodeFromCallbackUrl(page, state)
    return { code, codeVerifier }
  }

  test("confidential client without client_secret -> invalid_client error", async ({ page }) => {
    const { code, codeVerifier } = await getValidAuthCode(page)

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      client_id: TEST_CLIENT_ID,
      code_verifier: codeVerifier,
    })
    const response = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe("invalid_client")
  })

  test("confidential client with wrong client_secret -> invalid_client error", async ({ page }) => {
    const { code, codeVerifier } = await getValidAuthCode(page)

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      client_id: TEST_CLIENT_ID,
      client_secret: "wrong-secret",
      code_verifier: codeVerifier,
    })
    const response = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe("invalid_client")
  })

  test("confidential client with correct client_secret -> succeed", async ({ page }) => {
    const { code, codeVerifier } = await getValidAuthCode(page)

    const tok = await exchangeCodeForToken(code, { kind: "bearer" }, codeVerifier)
    expect(tok.access_token).toBeTruthy()
  })

  test("invalid client_id -> invalid_client error", async () => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: "some-code",
      redirect_uri: getRedirectUri(),
      client_id: "non-existent-client-id",
      client_secret: TEST_CLIENT_SECRET,
    })
    const response = await fetch(TOKEN, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    })
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe("invalid_client")
  })
})
