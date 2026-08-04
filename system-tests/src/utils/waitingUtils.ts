import { test } from "@playwright/test"
import type { Page } from "playwright"

interface PollUntilOptions {
  /** Total time to keep polling before failing, in ms. */
  timeout?: number
  /** Delay between attempts, in ms. */
  interval?: number
  /** Included in the failure message so a timeout says what never happened. */
  description?: string
}

/**
 * For state Playwright's own auto-retrying assertions cannot see: a database row a worker tick was
 * supposed to write, an API response that only changes after a background job. Anything visible in
 * the DOM belongs in `expect(locator)` instead, which reports better on failure.
 *
 * Use `expect.poll` instead when the polling *is* the assertion: it prints the expected and received
 * values on a timeout, where this can only name what never happened.
 */
export const pollUntil = async <T>(
  condition: () => Promise<T>,
  { timeout = 15000, interval = 250, description = "condition" }: PollUntilOptions = {},
): Promise<NonNullable<T>> => {
  const deadline = Date.now() + timeout
  let lastError: unknown = null
  for (;;) {
    try {
      const result = await condition()
      if (result) {
        return result as NonNullable<T>
      }
    } catch (error) {
      lastError = error
    }
    if (Date.now() >= deadline) {
      const suffix = lastError ? ` Last error: ${lastError}` : ""
      throw new Error(`Timed out after ${timeout}ms waiting for ${description}.${suffix}`)
    }
    await new Promise((resolve) => {
      setTimeout(resolve, interval)
    })
  }
}

export const waitForFooterTranslationsToLoad = async (page: Page) => {
  await test.step(
    "Wait for footer translations to load",
    async () => {
      await page.getByText("high-quality").waitFor({ state: "attached" })
    },
    { box: true },
  )
}
