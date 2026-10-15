import { test as base } from "@playwright/test"

import { ensureServer, getRedirectServerUri } from "@/utils/oauth/redirectServer"
import { setupServer, teardownServer } from "@/utils/setupServer"

const HTML = "<!doctype html><title>OAuth Callback</title><h1>Callback OK</h1>"

const redirectServerContext = {
  port: null,
  setupCount: 0,
  setupPromise: null,
  server: null,
  html: HTML,
}

export const setupRedirectServer = () => setupServer(redirectServerContext)
export const teardownRedirectServer = () => teardownServer(redirectServerContext.setupCount)
export const getRedirectUri = () => getRedirectServerUri(redirectServerContext.port)
export const ensureRedirectServer = () => ensureServer(redirectServerContext.server)
/**
 * OAuth test fixtures. Use this test in any spec that needs the OAuth callback server.
 *
 * The callback server is worker-scoped: one server per Playwright worker, set up before
 * any test in that worker and torn down when the worker exits.
 * See: https://playwright.dev/docs/test-fixtures#worker-scoped-fixtures
 */
// Empty object type required by Playwright's extend() for "no extra test fixtures"
// oxlint-disable-next-line typescript/no-empty-object-type, typescript/ban-types -- Playwright extend() requires {} for the no-extra-fixtures type arg
export const test = base.extend<{}, { oauthCallbackServer: void }>({
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
export type { BrowserContext, Page } from "@playwright/test"
