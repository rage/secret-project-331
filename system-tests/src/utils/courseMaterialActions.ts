/* eslint-disable playwright/no-wait-for-timeout */
import { test } from "@playwright/test"
import { Page } from "playwright"

// The course material Page component renders a hidden sentinel carrying the result of its dialog
// decision. `data-dialogs-ready="true"` means the frontend has finished deciding which dialog (if
// any) to show; `data-active-dialog` then names that dialog. Waiting on this is deterministic, so we
// avoid polling for dialogs that might still be on their way in.
const DIALOG_STATE_SELECTOR = `[data-testid="dialog-decision-state"]`

/** Waits until the frontend has finished deciding which course-material dialog (if any) to show. */
async function waitForDialogDecision(page: Page, timeout?: number) {
  await page
    .locator(`${DIALOG_STATE_SELECTOR}[data-dialogs-ready="true"]`)
    .waitFor({ state: "attached", timeout })
}

/** The dialog the frontend has currently decided to show, e.g. "choose-instance", "ai-usage-notice"
 * or "none". Only meaningful once {@link waitForDialogDecision} has resolved. */
function activeDialog(page: Page) {
  return page.locator(DIALOG_STATE_SELECTOR).getAttribute("data-active-dialog")
}

/** Acknowledges the AI-usage / academic-integrity notice if it is shown.
 *
 * The notice is displayed once per user per course, right after the user selects a course instance.
 */
export async function acknowledgeAiUsageNoticeIfPrompted(page: Page) {
  await test.step(
    "Acknowledge AI-usage notice if prompted",
    async () => {
      await waitForDialogDecision(page)
      if ((await activeDialog(page)) === "ai-usage-notice") {
        await page.getByTestId("ai-usage-notice-agree-checkbox").click()
        await page.getByTestId("ai-usage-notice-acknowledge-button").click()
        await page.getByTestId("ai-usage-notice-acknowledge-button").waitFor({ state: "detached" })
      }
    },
    { box: true },
  )
}

/** Waits for the frontend to decide whether the select course instance modal should open, and if so,
 * selects a course instance.
 *
 * This should be used instead of `await page.click('button:has-text("Continue")')`. This is because we might have other system tests that use the same course with the same user and this function makes sure those tests don't race with each other.
 */
export async function selectCourseInstanceIfPrompted(
  page: Page,
  courseVariantName?: string | undefined,
  /** Maximum time to wait for the frontend to finish deciding which dialog to show. */
  timeout?: number,
  /**
   * Whether to also acknowledge the AI-usage notice that appears after enrolling. Defaults to
   * `true`. Set to `false` in tests that need to assert on the notice themselves.
   */
  acknowledgeAiUsageNotice = true,
) {
  await test.step(
    "Select course instance if prompted",
    async () => {
      await waitForDialogDecision(page, timeout)

      if ((await activeDialog(page)) === "choose-instance") {
        if (courseVariantName === undefined) {
          await page.getByTestId("default-course-instance-radiobutton").click()
        } else {
          await page.locator(`label:has-text("${courseVariantName}")`).click()
        }

        await page.getByTestId("select-course-instance-continue-button").click()
        // The heading only detaches once the post-enrollment refetch resolves and the dialog step
        // changes, so this also waits out that refetch before we look for the next dialog.
        await page.getByTestId("select-course-instance-heading").waitFor({ state: "detached" })
      }

      // After enrolling, the AI-usage notice is shown once and must be acknowledged before the
      // user can interact with the material. Tests asserting on the notice can opt out.
      if (acknowledgeAiUsageNotice) {
        await acknowledgeAiUsageNoticeIfPrompted(page)
      }
    },
    { box: true },
  )
}

/** Navigates to the next page and verifies the page has actually changed.
 *
 * This function clicks the "Next page" link and waits for the URL to change,
 * ensuring that the navigation was successful and the page has actually loaded.
 * If the page hasn't changed after a short while, it retries the click.
 */
export async function navigateToNextPageInMaterial(page: Page) {
  await test.step(
    "Navigate to next page",
    async () => {
      // Find the next page link
      const nextPageLink = page.getByRole("link", { name: /Next page:/ })

      // Get the current URL before navigation
      const originalUrl = page.url()

      // Scroll the link into view and click it
      await nextPageLink.scrollIntoViewIfNeeded()
      await page.waitForTimeout(100)
      await nextPageLink.click()

      // Wait for the URL to change, indicating the page has actually navigated
      let urlChanged = false
      let attempts = 0
      const maxAttempts = 3

      while (!urlChanged && attempts < maxAttempts) {
        try {
          await page.waitForFunction(
            (originalUrl) => window.location.href !== originalUrl,
            originalUrl,
            { timeout: 3000 },
          )
          urlChanged = true
        } catch (error) {
          console.warn("Failed to navigate to next page, retrying...", error)
          attempts++
          if (attempts < maxAttempts) {
            // If URL hasn't changed, try clicking again
            await nextPageLink.click()
          } else {
            throw new Error(`Failed to navigate to next page after ${maxAttempts} attempts`, {
              cause: error,
            })
          }
        }
      }
    },
    { box: true },
  )
}

export function getExerciseRegion(page: Page, exerciseName: string) {
  return page.getByRole("region", { name: exerciseName })
}
