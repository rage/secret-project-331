import type { Page } from "../../fixtures/oauth"
import { expect, test } from "../../fixtures/oauth"
import { login } from "../../utils/login"
import {
  EXERCISE_SERVICES_SCOPE,
  TMC_CLI_VSCODE_CLIENT_ID,
  TMC_CLI_VSCODE_NOSCOPE_CLIENT_ID,
} from "../../utils/oauth/constants"
import {
  callClientCourses,
  pollDeviceToken,
  requestDeviceAuthorization,
} from "../../utils/oauth/deviceFlowHelpers"

/**
 * End-to-end coverage for the OAuth 2.0 Device Authorization Grant (RFC 8628)
 * feeding the exercise-services client API.
 *
 * The one-live-refresh-token-family-per-(user, client) rotation rule means each
 * token-issuing scenario uses a DISTINCT user so a rotation in one scenario can
 * never revoke another's family. All scenarios use the device clients seeded for
 * this flow (never the shared test-client-id), so they don't disturb the other
 * OAuth specs' consent/token state.
 */

/** Log in (leaving the session active) and approve the pending device code in the browser. */
async function loginAndDecide(
  page: Page,
  email: string,
  password: string,
  verificationUriComplete: string,
  decision: "approve" | "deny",
): Promise<void> {
  await login(email, password, page, true)
  await page.goto(verificationUriComplete)
  // The user_code came in via the query string, so the consent form resolves directly.
  const button =
    decision === "approve"
      ? page.getByTestId("oauth-device-approve-button")
      : page.getByTestId("oauth-device-deny-button")
  await button.click()
  const result =
    decision === "approve"
      ? page.getByTestId("oauth-device-approved")
      : page.getByTestId("oauth-device-denied")
  await result.waitFor({ state: "visible" })
}

test.describe("OAuth device authorization flow", () => {
  test("pending, slow_down, approve, then a token that reaches the client API (200)", async ({
    page,
  }) => {
    const device = await requestDeviceAuthorization(
      TMC_CLI_VSCODE_CLIENT_ID,
      EXERCISE_SERVICES_SCOPE,
    )
    expect(device.user_code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/)

    // Poll before approval: authorization_pending.
    const pending = await pollDeviceToken(device.device_code, TMC_CLI_VSCODE_CLIENT_ID)
    expect(pending.status).toBe(400)
    expect(pending.body.error).toBe("authorization_pending")

    // Immediate second poll (faster than the interval): slow_down.
    const tooFast = await pollDeviceToken(device.device_code, TMC_CLI_VSCODE_CLIENT_ID)
    expect(tooFast.status).toBe(400)
    expect(tooFast.body.error).toBe("slow_down")

    // Approve in the browser as a distinct user.
    await loginAndDecide(
      page,
      "student1@example.com",
      "student1",
      device.verification_uri_complete,
      "approve",
    )

    // Poll again: tokens are issued.
    const issued = await pollDeviceToken(device.device_code, TMC_CLI_VSCODE_CLIENT_ID)
    expect(issued.status).toBe(200)
    expect(issued.body.access_token).toBeTruthy()
    expect(issued.body.refresh_token).toBeTruthy()

    // The access token authenticates against the exercise-services client API.
    const courses = await callClientCourses(issued.body.access_token as string)
    expect(courses.status).toBe(200)
    expect(Array.isArray(courses.body)).toBe(true)
  })

  test("denying the device code yields access_denied on the next poll", async ({ page }) => {
    const device = await requestDeviceAuthorization(
      TMC_CLI_VSCODE_CLIENT_ID,
      EXERCISE_SERVICES_SCOPE,
    )

    await loginAndDecide(
      page,
      "student2@example.com",
      "student2",
      device.verification_uri_complete,
      "deny",
    )

    const denied = await pollDeviceToken(device.device_code, TMC_CLI_VSCODE_CLIENT_ID)
    expect(denied.status).toBe(400)
    expect(denied.body.error).toBe("access_denied")
  })

  test("a token without the exercise-services scope is rejected by the client API (403)", async ({
    page,
  }) => {
    // This client is seeded with the `openid` scope only, so its device-flow token
    // lacks exercise-services and must be refused by the scope gate.
    const device = await requestDeviceAuthorization(TMC_CLI_VSCODE_NOSCOPE_CLIENT_ID, "openid")

    await loginAndDecide(
      page,
      "student3@example.com",
      "student3",
      device.verification_uri_complete,
      "approve",
    )

    const issued = await pollDeviceToken(device.device_code, TMC_CLI_VSCODE_NOSCOPE_CLIENT_ID)
    expect(issued.status).toBe(200)
    expect(issued.body.access_token).toBeTruthy()

    const courses = await callClientCourses(issued.body.access_token as string)
    expect(courses.status).toBe(403)
  })

  test("a garbage bearer token is rejected by the client API (401)", async () => {
    const courses = await callClientCourses("this-is-not-a-valid-access-token")
    expect(courses.status).toBe(401)
  })
})
