import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectUrlPathWithRandomUuid from "../utils/expect"
import { getLocatorForNthExerciseServiceIframe } from "../utils/iframeLocators"
import { selectOrganization } from "../utils/organizationUtils"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"
test.use({
  storageState: "src/states/admin@example.com.json",
})
test.describe("Model solutions", () => {
  test("model-solutions are displayed in submissions", async ({ page, headless }, testInfo) => {
    await page.goto("http://project-331.local/organizations")

    await Promise.all([
      await selectOrganization(page, "University of Helsinki, Department of Computer Science"),
    ])
    await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

    await page.locator("[aria-label=\"Manage course 'Model solutions'\"] svg").click()

    await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]")

    // await Promise.all([
    //
    //   page.getByText("view submissions").click(),
    // ])
    await page.getByText("Exercises").click()
    await page.getByText("Best exercise").first().click()
    await page.locator(`text="Submission time"`).waitFor()
    await page.click("td > a")

    await expectUrlPathWithRandomUuid(page, "/submissions/[id]")

    // Wait for the frame to be visible
    const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "model-solutions-in-submissions",
      waitForTheseToBeVisibleAndStable: [frame.getByText("a")],

      beforeScreenshot: async () => {
        await page.evaluate(() => {
          const divs = document.querySelectorAll("div")
          for (const div of Array.from(divs)) {
            if (
              div.children.length === 0 &&
              div.textContent &&
              div.textContent.includes("Submitted at")
            ) {
              div.innerHTML = "Submitted at yyyy-mm-dd by xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            }
          }
        })
      },
    })
  })

  test("model-solutions are not displayed in the exercises", async ({
    page,
    headless,
  }, testInfo) => {
    await page.goto("http://project-331.local/organizations")

    await Promise.all([
      await page.getByText("University of Helsinki, Department of Computer Science").click(),
    ])
    await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

    await page.getByText("Model solutions").click()

    await selectCourseInstanceIfPrompted(page)

    await page.getByText("The Basics").click()
    await expectUrlPathWithRandomUuid(page, "/org/uh-cs/courses/model-solutions/chapter-1")

    await page.getByText("Page One").first().click()
    await expectUrlPathWithRandomUuid(page, "/org/uh-cs/courses/model-solutions/chapter-1/page-1")
    // Wait for the frame to be visible
    // eslint-disable-next-line playwright/no-networkidle
    await page.waitForLoadState("networkidle")

    const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "model-solutions-in-exercises",
      waitForTheseToBeVisibleAndStable: [frame.getByText("a")],
    })
  })
})
