import { test } from "@playwright/test"

import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice-clickable screenshot test", async ({ page, headless }) => {
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes example, multiple-choice clickable" })

  const frame = getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-clickable",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text="Choose your favorite colors"`),
      frame.locator(`text=Cyan`),
      frame.locator(`text=Sienna`),
      frame.locator(`text=LawnGreen`),
    ],
    screenshotTarget: frame,
  })

  await frame.locator(`button:text("Cyan")`).click()
  await frame.locator(`button:text("Sienna")`).click()
  await frame.locator(`button:text("LawnGreen")`).click()

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-clickable-answered",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text="Choose your favorite colors"`),
      frame.locator(`text=Cyan`),
      frame.locator(`text=Sienna`),
      frame.locator(`text=LawnGreen`),
    ],
    screenshotTarget: frame,
  })
})
