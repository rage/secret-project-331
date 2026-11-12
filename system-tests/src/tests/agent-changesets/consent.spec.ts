import { expect, test } from "@playwright/test"

import { AGENT_CLIENT_ID, AGENT_CLIENT_NAME, AGENT_CONSENT_EMAIL } from "@/utils/agentChangesets"
import { ConsentPage } from "@/utils/oauth/consentPage"
import { AUTHORIZE, BASE, MCP_RESOURCE } from "@/utils/oauth/constants"

test.use({ storageState: `src/states/${AGENT_CONSENT_EMAIL}.json` })

const REDIRECT_URI = "http://127.0.0.1:43123/callback"

test("consent screen lets the teacher choose the agent's permissions", async ({ page }) => {
  const query = new URLSearchParams({
    client_id: AGENT_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "material:read material:stage material:publish settings:write",
    response_type: "code",
    state: "agent-consent-state",
    nonce: "agent-consent-nonce",
    code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    code_challenge_method: "S256",
    resource: MCP_RESOURCE,
  })
  const consent = new ConsentPage(page, [
    "material:read",
    "material:stage",
    "material:publish",
    "settings:write",
  ])
  await page.goto(`${BASE}/oauth_authorize_scopes?${query.toString()}`)

  await consent.expectVisible(AGENT_CLIENT_NAME)
  await expect(consent.clientId).toHaveText(AGENT_CLIENT_ID)
  await expect(consent.redirectUri).toHaveText(REDIRECT_URI)
  await expect(consent.agentNote).toContainText("The return address is on your own computer.")

  await expect(consent.scopeCheckbox("material:read")).toBeChecked()
  await expect(consent.scopeCheckbox("material:read")).toBeDisabled()
  await expect(consent.scopeCheckbox("material:stage")).toBeChecked()
  await expect(consent.scopeCheckbox("material:publish")).toBeChecked()
  await expect(consent.scopeCheckbox("settings:write")).not.toBeChecked()

  await consent.scopeCheckbox("material:stage").uncheck()

  // The authorize endpoint would fetch the client's metadata document from the internet; the
  // consent screen's part ends once it redirects there.
  await page.route(`${AUTHORIZE}?**`, (route) =>
    route.fulfill({ status: 200, contentType: "text/plain", body: "authorize" }),
  )
  const consentRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url() === `${BASE}/api/v0/main-frontend/oauth/consent`,
  )
  const authorizeRequest = page.waitForRequest((request) =>
    request.url().startsWith(`${AUTHORIZE}?`),
  )
  await consent.approveWithoutRedirect()

  expect((await consentRequest).postDataJSON()).toMatchObject({
    client_id: AGENT_CLIENT_ID,
    scope: "material:read material:publish",
    resource: MCP_RESOURCE,
  })
  const authorizeUrl = new URL((await authorizeRequest).url())
  expect(authorizeUrl.searchParams.get("scope")).toBe("material:read material:publish")
  expect(authorizeUrl.searchParams.get("resource")).toBe(MCP_RESOURCE)
})
