/* eslint-disable playwright/no-wait-for-timeout */

import { Page } from "playwright"

import { LOADING_SPINNER_TEST_ID } from "@/shared-module/common/utils/constants"

/**
 * Waits until every node with {@link LOADING_SPINNER_TEST_ID} is detached so snapshots and axe
 * checks do not run against incomplete UI.
 */
export default async function waitForSpinnersToDisappear(
  page: Page,
  failureMessage: string,
): Promise<void> {
  try {
    await page.waitForTimeout(100)
    for (let i = 0; i < 2; i++) {
      const spinnerLocators = await page.getByTestId(LOADING_SPINNER_TEST_ID).all()
      await Promise.all(spinnerLocators.map((locator) => locator.waitFor({ state: "detached" })))
    }
  } catch (e) {
    console.warn(`Spinner did not disappear: ${e}`)
    throw new Error(failureMessage)
  }
}
