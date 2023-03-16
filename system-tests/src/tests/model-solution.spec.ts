import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../utils/courseMaterialActions"
import expectUrlPathWithRandomUuid from "../utils/expect"
import { getLocatorForNthExerciseServiceIframe } from "../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"

test.use({
  storageState: "src/states/admin@example.com.json",
})
test.describe("Model solutions", () => {
  test("model-solutions are displayed in submissions", async ({ page, headless }, testInfo) => {
    await page.goto("http://project-331.local/")

    await Promise.all([
      page.waitForNavigation(),
      await page.locator("text=University of Helsinki, Department of Computer Science").click(),
    ])
    await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

    await Promise.all([
      page.waitForNavigation(),
      page.locator("[aria-label=\"Manage course 'Model solutions'\"] svg").click(),
    ])

    await expectUrlPathWithRandomUuid(page, "/manage/courses/[id]")

    // await Promise.all([
    //   page.waitForNavigation(/*{ url: 'http://project-331.local/manage/exercises/6460b318-254c-4b70-9e1f-9ff6b2c3d461/submissions' }*/),
    //   page.locator("text=view submissions").click(),
    // ])
    await page.locator("text=Exercises").click()
    await page.locator("text=Best exercise").first().click()
    await page.locator(`text="Submission time"`).waitFor()

    await Promise.all([page.waitForNavigation(), page.click('a:has-text("link")')])
    await expectUrlPathWithRandomUuid(page, "/submissions/[id]")

    // Wait for the frame to be visible
    const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "model-solutions-in-submissions",
      waitForTheseToBeVisibleAndStable: [frame.locator("text=a")],

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
    await page.goto("http://project-331.local/")

    await Promise.all([
      page.waitForNavigation(),
      await page.locator("text=University of Helsinki, Department of Computer Science").click(),
    ])
    await expectUrlPathWithRandomUuid(page, "/org/uh-cs")

    await Promise.all([
      page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-everything' }*/),
      page.locator("text=Model solutions").click(),
    ])

    await selectCourseInstanceIfPrompted(page)

    await Promise.all([page.waitForNavigation(), page.locator("text=The Basics").click()])
    await expectUrlPathWithRandomUuid(page, "/org/uh-cs/courses/model-solutions/chapter-1")

    await Promise.all([page.waitForNavigation(), page.locator("text=Page One").first().click()])
    await expectUrlPathWithRandomUuid(page, "/org/uh-cs/courses/model-solutions/chapter-1/page-1")
    // Wait for the frame to be visible
    await page.waitForLoadState("networkidle")

    const frame = await getLocatorForNthExerciseServiceIframe(page, "example-exercise", 1)
    await expectScreenshotsToMatchSnapshots({
      screenshotTarget: page,
      headless,
      testInfo,
      snapshotName: "model-solutions-in-exercises",
      waitForTheseToBeVisibleAndStable: [frame.locator("text=a")],
    })
  })
})
