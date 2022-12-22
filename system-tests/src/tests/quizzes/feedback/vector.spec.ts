import { test } from "@playwright/test"

import { selectCourseInstanceIfPrompted } from "../../../utils/courseMaterialActions"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/user@example.com.json",
})

test("test quizzes vector feedback", async ({ headless, page }) => {
  await page.goto(
    "http://project-331.local/org/uh-cs/courses/introduction-to-everything/chapter-1/vector",
  )

  await selectCourseInstanceIfPrompted(page)

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "vector-initial",
    scrollToYCoordinate: 270,
  })

  await page.frameLocator("iframe").getByLabel("Answer").first().fill("a")
  await page.frameLocator("iframe").getByLabel("Answer").nth(1).fill("4")
  await page.frameLocator("iframe").getByLabel("Answer").nth(2).fill("5")

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "vector-filled",
    scrollToYCoordinate: 270,
  })

  await page.getByRole("button", { name: "Submit" }).click()

  await page.frameLocator("iframe").locator("text=Your answer was not correct.").first().waitFor()

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "vector-feedback-incorrect",
    scrollToYCoordinate: 270,
  })

  await page.getByRole("button", { name: "try again" }).click()

  await page.frameLocator("iframe").getByLabel("Answer").first().fill("3")

  await page.getByRole("button", { name: "Submit" }).click()

  await page.frameLocator("iframe").locator("text=Your answer was correct.").first().waitFor()

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "vector-feedback-correct",
    scrollToYCoordinate: 270,
  })

  await page.getByRole("button", { name: "try again" }).click()

  await page.frameLocator("iframe").getByLabel("Answer").first().fill("a")

  await page.getByRole("button", { name: "Submit" }).click()

  await page.frameLocator("iframe").locator("text=Your answer was not correct.").first().waitFor()

  await expectScreenshotsToMatchSnapshots({
    page,
    headless,
    snapshotName: "vector-feedback-incorrect-with-model-solution",
    scrollToYCoordinate: 270,
  })
})
