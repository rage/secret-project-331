import { Page } from "playwright"

import { EXERCISE_SERVICE_CONTENT_ID } from "../../shared-module/utils/constants"

/**
 *
 * @param page    Page, where peer review is filled
 * @param options Likert options chosen. First list in array is chosen likert options in first peer review and second list is answers for second peer review
 */
export const fillPeerReview = async (page: Page, options: string[]) => {
  await page.getByRole("button", { name: "Start peer review" }).click()
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
}

export const waitForIframeContent = (page: Page) => {
  return Promise.all(
    page.frames().map((f) => f.locator(`"div#${EXERCISE_SERVICE_CONTENT_ID}"`).click()),
  )
}

export const TIMEOUT = 60000
