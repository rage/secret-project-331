/**
 * The suite's shared Playwright fixtures, and the stored sessions they are built from. Import `test`
 * and `expect` from here instead of from `@playwright/test` in a spec that uses a fixture.
 *
 * `test.use({ storageState })` already covers a spec that acts as one person for its whole run. A
 * fixture is for the spec that needs a second identity at the same time: driving a student's session
 * while reading what an admin view says about it.
 */

import type { APIRequestContext } from "@playwright/test"
import { test as base } from "@playwright/test"

export const ADMIN_STORAGE_STATE = "src/states/admin@example.com.json"

interface Fixtures {
  /**
   * An admin API context, disposed with the test.
   *
   * A request context rather than a browser one: these specs read admin routes to check what a row
   * looks like from the other side, and a whole browser for that is a page nobody looks at.
   */
  adminApi: APIRequestContext
}

export const test = base.extend<Fixtures>({
  // Playwright calls the second argument `use`, which the React hooks lint rule reads as a call to
  // React's `use`. Renamed rather than suppressed, so the next fixture added here needs no exception.
  adminApi: async ({ playwright }, provide) => {
    const context = await playwright.request.newContext({ storageState: ADMIN_STORAGE_STATE })
    await provide(context)
    await context.dispose()
  },
})

export { expect } from "@playwright/test"
