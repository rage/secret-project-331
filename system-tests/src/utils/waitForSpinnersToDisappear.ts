/* oxlint-disable playwright/no-wait-for-timeout */

import type { Page } from "playwright"

import { LOADING_SPINNER_TEST_ID } from "@/shared-module/common/utils/constants"
import {
  LOADING_REGION_TEST_ID,
  QUERY_INITIAL_LOADING_TEST_ID,
  QUERY_LOADING_SPINNER_TEST_ID,
  QUERY_REFRESHING_TEST_ID,
  SPINNER_TEST_ID,
} from "@/shared-module/components/components/loadingTestIds"

const LOADING_TEST_IDS = [
  ...new Set([
    LOADING_SPINNER_TEST_ID,
    SPINNER_TEST_ID,
    LOADING_REGION_TEST_ID,
    QUERY_INITIAL_LOADING_TEST_ID,
    QUERY_LOADING_SPINNER_TEST_ID,
    QUERY_REFRESHING_TEST_ID,
  ]),
]

/**
 * Waits until every node carrying a loading testid (spinner, LoadingRegion or QueryResult) is
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
      await page.waitForTimeout(100)
    }
  } catch (e) {
    console.warn(`Spinner did not disappear: ${e}`)
    throw new Error(failureMessage ?? "Loading indicator did not disappear", { cause: e })
  }
}
