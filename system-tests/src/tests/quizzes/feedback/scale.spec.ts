/* oxlint-disable playwright/prefer-locator */
import { expect, test } from "@playwright/test"

import { selectOrganization } from "@/utils/organizationUtils"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})

test.describe("Quizzes scale feedback", () => {
  // Chrome sometimes does not render the ui correctly after resizing the window without reloading the page.
  // This does not seem to be something we can fix, so we'll retry
  test.describe.configure({ retries: 4 })

  test("quizzes open feedback", async ({ page, headless }, testInfo) => {
    await page.goto("http://project-331.local/organizations")

    await selectOrganization(page, "University of Helsinki, Department of Computer Science")

    await expect(page).toHaveURL("http://project-331.local/org/uh-cs")

    await page.getByRole("link", { name: "Introduction to everything", exact: true }).click()

    await selectCourseInstanceIfPrompted(page)

    await page.getByText("The Basics").click()

    await expect(page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1",
    )

    await page.getByText("scale").first().click()
    await expect(page).toHaveURL(
      "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/scale",
    )

    await page
      .frameLocator('iframe[title="Exercise 2\\, task 1 content"]')
      .getByText("What is this?")
      .first()
      .waitFor()

    // oxlint-disable-next-line playwright/no-conditional-in-test
    if (testInfo.retry && (await page.getByText("Try again").isVisible())) {
      await page.getByText("Try again").click()
      await page.getByText("Try again").waitFor({ state: "hidden" })
      await page
        .frameLocator('iframe[title="Exercise 2\\, task 1 content"]')
        .getByText("What is this?")
        .first()
        .waitFor()
    }

    await page
      .frameLocator('iframe[title="Exercise 2\\, task 1 content"]')
      .getByLabel("What is this?")
      .getByText("4")
      .check()
    await page
      .frameLocator('iframe[title="Exercise 2\\, task 1 content"]')
      .getByLabel("And this?")
      .getByText("3")
      .check()
    await page
      .frameLocator('iframe[title="Exercise 2\\, task 1 content"]')
      .getByLabel("Please rate this")
      .getByText("1")
      .check()
    await page.getByText("Submit").click()
    await page.getByText("Try again").waitFor()
    await page.frameLocator("iframe").locator(`input[aria-label="3"]:disabled`).first().waitFor()
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "scale-feedback",
    })
  })
})
