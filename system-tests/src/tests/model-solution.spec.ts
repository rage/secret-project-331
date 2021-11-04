import { test } from "@playwright/test"

import expectPath from "../utils/expect"
import expectScreenshotsToMatchSnapshots from "../utils/screenshot"
import waitForFunction from "../utils/waitForFunction"

test.use({
  storageState: "src/states/admin@example.com.json",
})
test.describe("Model solutions", () => {
  test("model-solutions are displayed in submissions", async ({ headless, page }) => {
    // Go to http://project-331.local/
    await page.goto("http://project-331.local/")
    // Click text=University of Helsinki, Department of Computer Science
    await Promise.all([
      page.waitForNavigation(),
      await page.click("text=University of Helsinki, Department of Computer Science"),
    ])
    expectPath(page, "/organizations/[id]")

    // Click text=Manage
    await Promise.all([page.waitForNavigation(), await page.click("text=Manage")])
    expectPath(page, "/manage/courses/[id]")
    // Click text=view submissions
    await Promise.all([
      page.waitForNavigation(/*{ url: 'http://project-331.local/manage/exercises/6460b318-254c-4b70-9e1f-9ff6b2c3d461/submissions' }*/),
      page.click("text=view submissions"),
    ])
    // Click a:has-text("link")
    await page.click('a:has-text("link")')
    expectPath(page, "/submissions/[id]")

    // Wait for the frame to be visible
    const frame = await waitForFunction(page, () =>
      page.frames().find((f) => {
        return f.url().startsWith("http://project-331.local/example-exercise/submission")
      }),
    )

    const stableElement = await frame.waitForSelector("text=a")

    await expectScreenshotsToMatchSnapshots({
      axeSkip: true, // not for new screenshots
      page,
      headless,
      snapshotName: "model-solutions-in-submissions",
      waitForThisToBeVisibleAndStable: stableElement,
      toMatchSnapshotOptions: { threshold: 0.4 },
    })
  })

  test("model-solutions are not displayed in the exercises", async ({ headless, page }) => {
    // Go to http://project-331.local/
    await page.goto("http://project-331.local/")
    // Click text=University of Helsinki, Department of Computer Science
    await Promise.all([
      page.waitForNavigation(),
      await page.click("text=University of Helsinki, Department of Computer Science"),
    ])
    expectPath(page, "/organizations/[id]")
    // Click text=Introduction to Everything
    await Promise.all([
      page.waitForNavigation(/*{ url: 'http://project-331.local/courses/introduction-to-everything' }*/),
      page.click("text=Introduction to Everything"),
    ])

    // Click text=default
    await page.click("text=default")
    // Click button:has-text("Continue")
    await page.click('button:has-text("Continue")')
    // Click text=Chapter 1: The Basics
    await Promise.all([page.waitForNavigation(), page.click("text=The Basics")])
    expectPath(page, "/courses/introduction-to-everything/chapter-1")
    // Click text=Page One
    await Promise.all([page.waitForNavigation(), page.click("text=Page One")])
    expectPath(page, "/courses/introduction-to-everything/chapter-1/page-1")
    // Wait for the frame to be visible
    await page.waitForLoadState("networkidle")

    // Wait for the frame to be visible
    const frame = await waitForFunction(page, () =>
      page.frames().find((f) => {
        return f.url().startsWith("http://project-331.local/example-exercise/exercise")
      }),
    )

    const stableElement = await frame.waitForSelector("text=a")

    await expectScreenshotsToMatchSnapshots({
      axeSkip: true, // not for new screenshots
      page,
      headless,
      snapshotName: "model-solutions-in-exercises",
      waitForThisToBeVisibleAndStable: stableElement,
      toMatchSnapshotOptions: { threshold: 0.4 },
    })
  })
})
