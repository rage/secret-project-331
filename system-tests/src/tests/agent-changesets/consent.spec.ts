import { expect, test } from "@playwright/test"

import {
  AGENT_CLIENT_ID,
  AGENT_CLIENT_NAME,
  AGENT_PUBLISHER_EMAIL,
  agentStorageState,
} from "@/utils/agentChangesets"

test.use({ storageState: agentStorageState(AGENT_PUBLISHER_EMAIL) })

const MCP_RESOURCE = "http://project-331.local/api/v0/mcp"
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
  await page.goto(`http://project-331.local/oauth_authorize_scopes?${query.toString()}`)

  const form = page.getByTestId("oauth-consent-form")
  await expect(form.getByRole("heading", { name: AGENT_CLIENT_NAME })).toBeVisible()
  await expect(form.getByTestId("oauth-consent-client-id")).toHaveText(AGENT_CLIENT_ID)
  await expect(form.getByTestId("oauth-consent-redirect-uri")).toHaveText(REDIRECT_URI)
  await expect(form.getByTestId("oauth-consent-agent-note")).toContainText(
    "The return address is on your own computer.",
  )

  const checkbox = (scope: string) =>
    form.getByTestId(`oauth-consent-scope-${scope}`).getByRole("checkbox")
  await expect(checkbox("material:read")).toBeChecked()
  await expect(checkbox("material:read")).toBeDisabled()
  await expect(checkbox("material:stage")).toBeChecked()
  await expect(checkbox("material:publish")).toBeChecked()
  await expect(checkbox("settings:write")).not.toBeChecked()

  await checkbox("material:stage").uncheck()

  // The authorize endpoint would fetch the client's metadata document from the internet; the
  // consent screen's part ends once it redirects there.
  await page.route("**/api/v0/main-frontend/oauth/authorize?**", (route) =>
    route.fulfill({ status: 200, contentType: "text/plain", body: "authorize" }),
  )
  const consentRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith("/api/v0/main-frontend/oauth/consent"),
  )
  const authorizeRequest = page.waitForRequest(/\/api\/v0\/main-frontend\/oauth\/authorize\?/)
  await page.getByTestId("oauth-consent-approve-button").click()

  expect((await consentRequest).postDataJSON()).toMatchObject({
    client_id: AGENT_CLIENT_ID,
    scope: "material:read material:publish",
    resource: MCP_RESOURCE,
  })
  const authorizeUrl = new URL((await authorizeRequest).url())
  expect(authorizeUrl.searchParams.get("scope")).toBe("material:read material:publish")
  expect(authorizeUrl.searchParams.get("resource")).toBe(MCP_RESOURCE)
})
