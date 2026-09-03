import type { Locator, Page } from "@playwright/test"
import { expect, test } from "@playwright/test"

import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { LOADING_AFFORDANCE_DELAY_MS } from "@/shared-module/components/styles/motion"
import { LOADING_TEST_IDS } from "@/utils/waitForSpinnersToDisappear"

/** Where to look for loading affordances: a whole page, or one region of it. */
export type LoadingScope = Page | Locator

/** Headroom over the component's own delay, for the render that follows the timer. */
const AFFORDANCE_MOUNT_MARGIN_MS = 50

export interface WaitForLoadingOptions {
  /** How long a not-yet-mounted affordance is given to appear. Pass 0 when it is already showing. */
  graceMs?: number
  /** Overrides the default expect timeout for the settle itself. */
  timeoutMs?: number
}

/**
 * Waits until nothing inside `scope` is loading.
 *
 * The sibling for a whole page is `utils/waitForSpinnersToDisappear`; reach for this one when only
 * a region has to settle and unrelated widgets elsewhere may still be fetching.
 *
 * A `Spinner` renders nothing at all for its first {@link LOADING_AFFORDANCE_DELAY_MS}, so a check
 * made right after triggering work finds an empty DOM and calls it settled. `graceMs` covers that.
 */
export async function waitForLoadingToFinish(
  scope: LoadingScope,
  options: WaitForLoadingOptions = {},
): Promise<void> {
  const { graceMs = LOADING_AFFORDANCE_DELAY_MS + AFFORDANCE_MOUNT_MARGIN_MS, timeoutMs } = options

  await test.step("Wait for loading to finish", async () => {
    // oxlint-disable-next-line playwright/no-wait-for-timeout -- a delayed affordance has no DOM node to wait on yet
    await pageOf(scope).waitForTimeout(graceMs)
    await expect(loadingAffordances(scope)).toHaveCount(0, omitUndefined({ timeout: timeoutMs }))
  })
}

/**
 * Asserts something inside `scope` is showing a loading affordance.
 *
 * Matches by test id: an unlabelled `Spinner` is `aria-hidden` with no role and no text, so no
 * role or text query can reach it.
 */
export async function expectLoading(scope: LoadingScope): Promise<void> {
  await test.step("Expect a loading affordance", async () => {
    await expect(loadingAffordances(scope).first()).toBeVisible()
  })
}

/** Matches every loading affordance inside `scope`, whichever component rendered it. */
function loadingAffordances(scope: LoadingScope): Locator {
  return LOADING_TEST_IDS.map((testId) => scope.getByTestId(testId)).reduce((all, one) =>
    all.or(one),
  )
}

function pageOf(scope: LoadingScope): Page {
  return "waitForTimeout" in scope ? scope : scope.page()
}
