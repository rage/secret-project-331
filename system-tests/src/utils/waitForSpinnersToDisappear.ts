/* oxlint-disable playwright/no-wait-for-timeout */

import { Page } from "playwright"

import { LOADING_SPINNER_TEST_ID } from "@/shared-module/common/utils/constants"

// Loading testids rendered by AnimatedQueryFrame (QueryResult / QueryResults wrappers).
const QUERY_LOADING_TEST_IDS = [
  "query-initial-loading",
  "query-loading-spinner",
  "query-refreshing",
]

const LOADING_TEST_IDS = [LOADING_SPINNER_TEST_ID, ...QUERY_LOADING_TEST_IDS]

/**
 * Waits until every node with {@link LOADING_SPINNER_TEST_ID} or a QueryResult loading testid is
 * detached so snapshots and axe checks do not run against incomplete UI.
 */
export default async function waitForSpinnersToDisappear(
  page: Page,
  failureMessage?: string,
): Promise<void> {
  try {
    await page.waitForTimeout(100)
    for (let i = 0; i < 2; i++) {
      const spinnerLocators = (
        await Promise.all(LOADING_TEST_IDS.map((testId) => page.getByTestId(testId).all()))
      ).flat()
      await Promise.all(spinnerLocators.map((locator) => locator.waitFor({ state: "detached" })))
    }
  } catch (e) {
    console.warn(`Spinner did not disappear: ${e}`)
    throw new Error(failureMessage ?? "Loading indicator did not disappear", { cause: e })
  }
}
