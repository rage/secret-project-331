import { test } from "@playwright/test"

import { getLocatorForNthExerciseServiceIframe } from "../../../utils/iframeLocators"
import expectScreenshotsToMatchSnapshots from "../../../utils/screenshot"

test.use({
  storageState: "src/states/teacher@example.com.json",
})

test("widget, multiple-choice-dropdown screenshot test", async ({ page, headless }) => {
  await page.goto("http://project-331.local/playground")

  await page.selectOption("select", { label: "Quizzes example, multiple-choice dropdown" })

  const frame = await getLocatorForNthExerciseServiceIframe(page, "quizzes", 1)

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-dropdown",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text="How many different CSS hexadecimal color codes there are?"`),
    ],
    screenshotTarget: frame,
  })

  await frame
    .locator(`select:right-of(:text("How many different CSS hexadecimal color codes there are?"))`)
    .first()
    .selectOption({ label: "at least two" })

  await frame
    .locator(`select:right-of(:text("What other ways there are to represent colors in CSS?"))`)
    .first()
    .selectOption({ label: "RGB -color system" })

  await expectScreenshotsToMatchSnapshots({
    headless,
    snapshotName: "widget-multiple-choice-dropdown-answered",
    waitForTheseToBeVisibleAndStable: [
      frame.locator(`text="How many different CSS hexadecimal color codes there are?"`),
      frame.locator(`text="How many different CSS hexadecimal color codes there are?"`),
      frame.locator(`text="What other ways there are to represent colors in CSS?"`),
    ],
    screenshotTarget: frame,
  })
})
