import { test as base } from "@playwright/test"

import { setupRedirectServer, teardownRedirectServer } from "../utils/oauth/redirectServer"

/**
 * OAuth test fixtures. Use this test in any spec that needs the OAuth callback server.
 *
 * The callback server is worker-scoped: one server per Playwright worker, set up before
 * any test in that worker and torn down when the worker exits.
 * See: https://playwright.dev/docs/test-fixtures#worker-scoped-fixtures
 */
export const test = base.extend<Record<string, never>, { oauthCallbackServer: void }>({
  oauthCallbackServer: [
    async ({}, use) => {
      await setupRedirectServer()
      await use()
      await teardownRedirectServer()
    },
    { scope: "worker", auto: true },
  ],
})
export { expect } from "@playwright/test"
