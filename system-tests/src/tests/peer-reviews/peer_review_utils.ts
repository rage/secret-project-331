import { Page } from "playwright"
import { expect, test } from "playwright/test"

import { EXERCISE_SERVICE_CONTENT_ID } from "../../shared-module/common/utils/constants"
import { selectCourseInstanceIfPrompted } from "../../utils/courseMaterialActions"

/**
 *
 * @param page    Page, where peer review is filled
 * @param options Likert options chosen. First list in array is chosen likert options in first peer review and second list is answers for second peer review
 */
export const fillPeerReview = async (
  page: Page,
  options: string[],
  startPeerReview: boolean = true,
) => {
  await test.step("Fill peer review", async () => {
    // eslint-disable-next-line playwright/no-conditional-in-test
    if (startPeerReview) {
      await page.getByRole("button", { name: "Start peer review" }).click()
    }

    // Check that the assignment is showing in the peer review page.
    await expect(page.getByTestId("assignment")).toContainText("Answer this question.")

    await page.getByPlaceholder("Write a review").fill("It was hard to understand")
    await page
      .locator(
        `:nth-match(p:text-is('${options[0]}'):below(span:has-text('Was the answer correct? *')), 1)`,
      )
      .click()
    await page
      .locator(
        `:nth-match(p:text-is('${options[1]}'):below(span:has-text('Was the answer good? *')), 1)`,
      )
      .click()
    await page.getByRole("button", { name: "Submit" }).first().click()
    await page.getByText("Operation successful!").waitFor()
  })
}

export const waitForIframeContent = (page: Page) => {
  return Promise.all(
    page.frames().map((f) => f.locator(`"div#${EXERCISE_SERVICE_CONTENT_ID}"`).click()),
  )
}

export const TIMEOUT = 60000

export const answerExercise = async (page: Page, pageUrl: string, chooseThisOption: string) => {
  await page.goto(pageUrl)
  await selectCourseInstanceIfPrompted(page)
  await page.frameLocator("iframe").getByRole("checkbox", { name: chooseThisOption }).click()
  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByText("Try again").waitFor()

  await page
    .frameLocator("iframe")
    .first()
    .locator("div#exercise-service-content-id")
    .click({ timeout: TIMEOUT })
}
