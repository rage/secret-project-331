/**
 * The suite's shared Playwright fixtures. Import `test` and `expect` from here rather than from
 * `@playwright/test` in a spec that uses one. A fixture is for a spec that needs a second identity at
 * the same time; one acting as a single person is served by `test.use({ storageState })`.
 */

import type { APIRequestContext } from "@playwright/test"
import { test as base } from "@playwright/test"

export const ADMIN_STORAGE_STATE = "src/states/admin@example.com.json"

interface Fixtures {
  /** An admin API request context, disposed with the test. Reading admin routes needs no browser. */
  adminApi: APIRequestContext
}

export const test = base.extend<Fixtures>({
  // Named `provide` rather than `use`: the React hooks lint rule reads `use(...)` as React's own.
  adminApi: async ({ playwright }, provide) => {
    const context = await playwright.request.newContext({ storageState: ADMIN_STORAGE_STATE })
    await provide(context)
    await context.dispose()
  },
})

export { expect } from "@playwright/test"
